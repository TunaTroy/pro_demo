sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/m/ViewSettingsFilterItem",
    "sap/ui/table/Table", // ✅ ADDED
    "sap/ui/table/Column", // ✅ ADDED
  ],
  function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    MessageBox,
    MessageToast,
    Spreadsheet,
    exportLibrary,
    ViewSettingsDialog,
    ViewSettingsItem,
    ViewSettingsFilterItem,
    Table, // ✅ ADDED
    Column // ✅ ADDED
  ) {
    "use strict";

    const EdmType = exportLibrary.EdmType;

    return Controller.extend("demodashboard.controller.RFQList", {
      // ========= FORMATTERS =========
      formatter: {
        /**
         * Format date to dd.MM.yyyy
         */
        dateFormat: function (sDate) {
          if (!sDate) return "N/A";
          try {
            let timestamp;

            // ✅ Trường hợp OData: "/Date(1740009600000)/"
            if (typeof sDate === "string" && sDate.indexOf("/Date(") === 0) {
              timestamp = parseInt(sDate.replace(/[^0-9]/g, ""), 10);
            }
            // ✅ Trường hợp ISO: "2025-11-12T00:00:00"
            else {
              timestamp = Date.parse(sDate);
            }

            if (isNaN(timestamp)) return "";
            const oDate = new Date(timestamp);

            const day = ("0" + oDate.getDate()).slice(-2);
            const month = ("0" + (oDate.getMonth() + 1)).slice(-2);
            const year = oDate.getFullYear();

            return `${day}.${month}.${year}`;
          } catch (e) {
            return "";
          }
        },

        /**
         * Format number with thousand separator
         */
        numberFormat: function (value) {
          if (value === null || value === undefined) return "0.0";
          const num = parseFloat(value);
          if (isNaN(num)) return "0.0";

          return num.toLocaleString("en-US", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
        },

        /**
         * Status text mapping
         */
        statusText: function (status) {
          if (!status) return "Unknown";

          const statusMap = {
            A: "In Preparation",
            R: "Released",
            P: "Pending Approval",
            C: "Completed",
            X: "Cancelled",
            "": "Unknown",
          };

          return statusMap[status] || status;
        },

        /**
         * Status state mapping for ObjectStatus colors
         */
        statusState: function (status) {
          if (!status) return "None";

          const stateMap = {
            R: "Success",
            A: "Warning",
            P: "Information",
            C: "Success",
            X: "Error",
          };

          return stateMap[status] || "None";
        },

        /**
         * Company Code with full name
         */
        companyCodeText: function (bukrs) {
          if (!bukrs) return "";

          const companyMap = {
            US00: "Global Bike Inc. (US00)",
            TE00: "Test Company (TE00)",
            DE00: "German Company (DE00)",
          };

          return companyMap[bukrs] || bukrs;
        },

        /**
         * Purchasing Organization with full name
         */
        purchOrgText: function (ekorg) {
          if (!ekorg) return "";

          const orgMap = {
            US00: "Global Bike US (US00)",
            TE00: "Test Purchasing Org (TE00)",
            DE00: "German Purchasing Org (DE00)",
          };

          return orgMap[ekorg] || ekorg;
        },

        /**
         * Purchasing Group with full name
         */
        purchGroupText: function (ekgrp) {
          if (!ekgrp) return "";

          const groupMap = {
            "001": "HABECO Nhập khẩu (001)",
            "002": "HABECO Xuất khẩu (002)",
            "003": "Standard Group (003)",
          };

          return groupMap[ekgrp] || ekgrp;
        },
      },

      // ========= INIT =========
      onInit: function () {
        // Initialize OData model
        this.oODataModel = this.getOwnerComponent().getModel();

        // View model for UI state
        const oViewModel = new JSONModel({
          busy: false,
          hasFilter: false,
          filterText: "",
          selectedItem: null,
          fieldSettings: this._loadFieldSettings(),
          columnSettings: this._loadColumnSettings(),
        });
        this.getView().setModel(oViewModel, "view");

        // Device model for responsive behavior
        const oDeviceModel = new JSONModel(sap.ui.Device);
        oDeviceModel.setDefaultBindingMode("OneWay");
        this.getView().setModel(oDeviceModel, "device");

        // Load RFQ data
        this._loadRFQList();
      },

      _createSimpleValueHelp: function (oEvent, sTitle, sKey, aValues) {
        const aRows = aValues.map((v) => {
          const obj = {};
          obj[sKey] = v;
          return obj;
        });

        const oRowsModel = new sap.ui.model.json.JSONModel({ rows: aRows });

        const oTable = new Table({
          visibleRowCount: 12,
          selectionMode: "MultiToggle",
          columns: [
            new Column({
              width: "180px",
              label: new sap.m.Label({ text: sTitle }),
              template: new sap.m.Text({ text: `{${sKey}}` }),
            }),
          ],
        });

        oTable.setModel(oRowsModel);
        oTable.bindRows("/rows");

        const oSearch = new sap.m.SearchField({
          width: "100%",
          placeholder: "Search...",
          liveChange: function (e) {
            const q = (e.getParameter("newValue") || "").toUpperCase();
            const filtered = aRows.filter((r) =>
              String(r[sKey]).toUpperCase().includes(q)
            );
            oRowsModel.setData({ rows: filtered });
          },
        });

        const oFilterBar = new sap.ui.comp.filterbar.FilterBar({
          advancedMode: false,
          filterGroupItems: [],
          basicSearch: oSearch,
        });

        const oMI = oEvent.getSource();

        const oVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
          title: sTitle,
          key: sKey,
          supportMultiselect: true,
          supportRanges: false,
          supportRangesOnly: false,
          ok: function () {
            const aIdx = oTable.getSelectedIndices();
            const aSelected = aIdx.map(
              (i) => oTable.getContextByIndex(i).getObject()[sKey]
            );

            oMI.removeAllTokens();
            aSelected.forEach((v) =>
              oMI.addToken(new sap.m.Token({ key: v, text: v }))
            );

            oVH.close();
          },
          cancel: function () {
            oVH.close();
          },
        });

        oVH.setFilterBar(oFilterBar);
        oVH.setTable(oTable);
        oVH.open();
      },

      // ========= Load Field Settings from localStorage =========
      _loadFieldSettings: function () {
        const sSaved = localStorage.getItem("rfqFieldSettings");
        const oDefaults = {
          rfqNumber: true, // mandatory
          targetValue: true,
          deadline: true,
          status: true,
          createdOn: true,
          createdBy: true,

          companyCodeInRFQ: false,
          purchOrgInRFQ: false,
          purchGroupInRFQ: false,
        };

        if (sSaved) {
          try {
            const aSaved = JSON.parse(sSaved);
            aSaved.forEach((field) => {
              if (field.key in oDefaults) {
                oDefaults[field.key] = field.selected;
              }
            });
          } catch (e) {
            console.error("Failed to load field settings:", e);
          }
        }

        return oDefaults;
      },

      // ========= Load Column Settings from localStorage =========
      _loadColumnSettings: function () {
        const sSaved = localStorage.getItem("rfqColumnSettings");
        const oDefaults = {
          description: true,
          companyCode: true,
          purchOrg: true,
          purchGroup: true,
        };

        if (sSaved) {
          try {
            const aSaved = JSON.parse(sSaved);
            aSaved.forEach((col) => {
              if (col.key in oDefaults) {
                oDefaults[col.key] = col.selected;
              }
            });
          } catch (e) {
            console.error("Failed to load column settings:", e);
          }
        }

        return oDefaults;
      },

      // Load RFQ From ZTB_OPT_PR
      _loadRFQList: function () {
        sap.ui.core.BusyIndicator.show(0);

        const oModel = this.oODataModel;

        // STEP 1 — gọi EKET001Set (176 dòng)
        const pEket = new Promise((resolve, reject) => {
          oModel.read("/EKET001Set", {
            success: (d) => resolve(d.results),
            error: reject,
          });
        });

        // STEP 2 — lấy list RFQ duy nhất từ EKET
        pEket
          .then((aEket) => {
            if (!aEket || aEket.length === 0) {
              this.getView().setModel(new JSONModel([]), "rfq");
              sap.ui.core.BusyIndicator.hide();
              MessageToast.show("No RFQ found for selected PR list.");
              return;
            }

            const aRFQ = [...new Set(aEket.map((e) => e.Ebeln))];

            // ⚠ Nếu không có RFQ thì thoát luôn
            if (aRFQ.length === 0) {
              this.getView().setModel(new JSONModel([]), "rfq");
              sap.ui.core.BusyIndicator.hide();
              MessageToast.show("No RFQ found for selected PR list.");
              return;
            }

            // ✅ Tạo 1 filter group OR cho tất cả EBELN
            const oRFQFilter = new Filter({
              filters: aRFQ.map(
                (r) => new Filter("Ebeln", FilterOperator.EQ, r)
              ),
              and: false, // OR giữa các Ebeln
            });

            // STEP 3 — load ProcurementHeaderSet theo RFQ
            const pHeader = new Promise((resolve, reject) => {
              oModel.read("/ProcurementHeaderSet", {
                filters: [
                  oRFQFilter, // list Ebeln
                  new Filter("Bstyp", FilterOperator.EQ, "A"), // 🔥 Only RFQ
                ],
                success: (d) => resolve(d.results),
                error: reject,
              });
            });

            // STEP 4 — load ItemSet để lấy Txz01
            const pItem = new Promise((resolve, reject) => {
              oModel.read("/ProcurementItemSet", {
                success: (d) => resolve(d.results),
                error: reject,
              });
            });

            return Promise.all([pHeader, pItem]);
          })
          .then(([aHeader, aItems]) => {
            // Merge description, data enrichment
            const mapItems = {};
            aItems.forEach((it) => {
              if (!mapItems[it.Ebeln]) mapItems[it.Ebeln] = [];
              mapItems[it.Ebeln].push(it);
            });

            aHeader.forEach((h) => {
              const aIt = mapItems[h.Ebeln] || [];
              h.Txz01 = aIt.length ? aIt[0].Txz01 : "";
              h.Angdt = h.Angdt || null;
              h.Aedat = h.Aedat || null;
              h.Ktwrt = h.Ktwrt || 0;
              h.Waers = h.Waers || "VND";
            });

            this.getView().setModel(new JSONModel(aHeader), "rfq");

            sap.ui.core.BusyIndicator.hide();
            MessageToast.show(`${aHeader.length} RFQs loaded (mapped to PR)`);
          })
          .catch((err) => {
            sap.ui.core.BusyIndicator.hide();
            MessageBox.error("Failed to load RFQ list.");
            console.error("Error loading RFQ:", err);
          });
      },

      // ========= FILTER (activated by GO) =========
      onFilterSearch: function () {
        const oTable = this.byId("rfqTable");
        const aFilters = [];

        // Auto-token RFQ No.
        const oRFQ = this.byId("rfqFilter");
        const sRFQtyped = oRFQ.getValue().trim();
        if (sRFQtyped) {
          oRFQ.addToken(new sap.m.Token({ key: sRFQtyped, text: sRFQtyped }));
          oRFQ.setValue("");
        }
        const aRFQTokens = oRFQ.getTokens();
        if (aRFQTokens.length > 0) {
          const aRFQf = aRFQTokens.map(
            (t) => new Filter("Ebeln", FilterOperator.EQ, t.getKey())
          );
          aFilters.push(new Filter({ filters: aRFQf, and: false }));
        }

        // Auto-token Created By
        const oErnam = this.byId("ernamFilter");
        const sErnamTyped = oErnam.getValue().trim();
        if (sErnamTyped) {
          oErnam.addToken(
            new sap.m.Token({ key: sErnamTyped, text: sErnamTyped })
          );
          oErnam.setValue("");
        }
        const aErnamTokens = oErnam.getTokens();
        if (aErnamTokens.length > 0) {
          const aErnamF = aErnamTokens.map(
            (t) => new Filter("Ernam", FilterOperator.EQ, t.getKey())
          );
          aFilters.push(new Filter({ filters: aErnamF, and: false }));
        }

        // Auto-token Company Code
        const oBukrs = this.byId("bukrsFilter");
        const sBukrs = oBukrs.getValue().trim();
        if (sBukrs) {
          oBukrs.addToken(new sap.m.Token({ key: sBukrs, text: sBukrs }));
          oBukrs.setValue("");
        }
        const aBukrsTokens = oBukrs.getTokens();
        if (aBukrsTokens.length > 0) {
          const aBukrsF = aBukrsTokens.map(
            (t) => new Filter("Bukrs", FilterOperator.EQ, t.getKey())
          );
          aFilters.push(new Filter({ filters: aBukrsF, and: false }));
        }

        // Auto-token Purch Org
        const oEkorg = this.byId("ekorgFilter");
        const sEkorg = oEkorg.getValue().trim();
        if (sEkorg) {
          oEkorg.addToken(new sap.m.Token({ key: sEkorg, text: sEkorg }));
          oEkorg.setValue("");
        }
        const aEkorgTokens = oEkorg.getTokens();
        if (aEkorgTokens.length > 0) {
          const aEkorgF = aEkorgTokens.map(
            (t) => new Filter("Ekorg", FilterOperator.EQ, t.getKey())
          );
          aFilters.push(new Filter({ filters: aEkorgF, and: false }));
        }

        // Auto-token Purch Group
        const oEkgrp = this.byId("ekgrpFilter");
        const sEkgrp = oEkgrp.getValue().trim();
        if (sEkgrp) {
          oEkgrp.addToken(new sap.m.Token({ key: sEkgrp, text: sEkgrp }));
          oEkgrp.setValue("");
        }
        const aEkgrpTokens = oEkgrp.getTokens();
        if (aEkgrpTokens.length > 0) {
          const aEkgrpF = aEkgrpTokens.map(
            (t) => new Filter("Ekgrp", FilterOperator.EQ, t.getKey())
          );
          aFilters.push(new Filter({ filters: aEkgrpF, and: false }));
        }

        // Quotation Deadline Date
        const oDFrom = this.byId("deadlineFilter").getDateValue();
        const oDTo = this.byId("deadlineFilter").getSecondDateValue();
        if (oDFrom && oDTo) {
          aFilters.push(new Filter("Angdt", FilterOperator.BT, oDFrom, oDTo));
        }

        // Created On Date
        const oCFrom = this.byId("createdFilter").getDateValue();
        const oCTo = this.byId("createdFilter").getSecondDateValue();
        if (oCFrom && oCTo) {
          aFilters.push(new Filter("Aedat", FilterOperator.BT, oCFrom, oCTo));
        }

        oTable.getBinding("items").filter(aFilters);

        const iCount = oTable.getBinding("items").getLength();
        MessageToast.show(`${iCount} item(s) found`);
      },

      // ========= SELECTION CHANGE =========
      onSelectionChange: function (oEvent) {
        const oItem = oEvent.getParameter("listItem");
        const oViewModel = this.getView().getModel("view");

        if (oItem) {
          const oContext = oItem.getBindingContext("rfq");
          oViewModel.setProperty("/selectedItem", oContext.getObject());
        } else {
          oViewModel.setProperty("/selectedItem", null);
        }
      },

      // ========= ITEM PRESS (Navigation) =========
      onItemPress: function (oEvent) {
        const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
        const oContext = oItem.getBindingContext("rfq");
        const sEbeln = oContext.getProperty("Ebeln");

        this.getOwnerComponent()
          .getRouter()
          .navTo("RFQDetail", { Ebeln: sEbeln });
      },

      // ========= RFQ PRESS (Link) =========
      onRFQPress: function (oEvent) {
        const oLink = oEvent.getSource();
        const sRFQNo = oLink.getCustomData()[0].getValue();
        MessageToast.show(`Opening RFQ: ${sRFQNo}`);
      },

      // ========= TABLE SETTINGS =========
      onTableSettings: function () {
        if (!this._oViewSettingsDialog) {
          this._oViewSettingsDialog = new ViewSettingsDialog({
            title: "View Settings",
            confirm: this.onConfirmViewSettings.bind(this),
            reset: this.onResetViewSettings.bind(this),
          });

          this.getView().addDependent(this._oViewSettingsDialog);
        }

        // Add filter items for RFQ column fields
        this._oViewSettingsDialog.removeAllFilterItems();
        const aRFQFields = this._getRFQColumnFields();
        aRFQFields.forEach((field) => {
          this._oViewSettingsDialog.addFilterItem(
            new ViewSettingsItem({
              key: field.key,
              text: field.text,
              selected: field.selected,
            })
          );
        });

        // Add sort items
        this._oViewSettingsDialog.removeAllSortItems();
        const aSortFields = this._getSortFields();
        aSortFields.forEach((field) => {
          this._oViewSettingsDialog.addSortItem(
            new ViewSettingsItem({
              key: field.key,
              text: field.text,
              selected: field.selected,
            })
          );
        });

        // Add presetFilterItems for Columns
        this._oViewSettingsDialog.removeAllPresetFilterItems();
        const aColumns = this._getColumnFields();
        aColumns.forEach((col) => {
          this._oViewSettingsDialog.addPresetFilterItem(
            new ViewSettingsItem({
              key: col.key,
              text: col.text,
              selected: col.selected,
            })
          );
        });

        this._oViewSettingsDialog.open("filter");
      },

      // ========= Get RFQ Column Fields Configuration =========
      _getRFQColumnFields: function () {
        const oSettings = this.getView()
          .getModel("view")
          .getProperty("/fieldSettings");

        return [
          { key: "rfqNumber", text: "RFQ", selected: true }, // mandatory
          {
            key: "targetValue",
            text: "Target Value",
            selected: oSettings.targetValue,
          },
          {
            key: "deadline",
            text: "Quotation Deadline",
            selected: oSettings.deadline,
          },
          { key: "status", text: "Status", selected: oSettings.status },
          {
            key: "createdOn",
            text: "Created On",
            selected: oSettings.createdOn,
          },
          {
            key: "createdBy",
            text: "Created By",
            selected: oSettings.createdBy,
          },

          {
            key: "companyCodeInRFQ",
            text: "Company Code",
            selected: oSettings.companyCodeInRFQ,
          },
          {
            key: "purchOrgInRFQ",
            text: "Purchasing Organization",
            selected: oSettings.purchOrgInRFQ,
          },
          {
            key: "purchGroupInRFQ",
            text: "Purchasing Group",
            selected: oSettings.purchGroupInRFQ,
          },
        ];
      },

      // ========= Get Column Fields Configuration =========
      _getColumnFields: function () {
        const oSettings = this.getView()
          .getModel("view")
          .getProperty("/columnSettings");

        return [
          {
            key: "description",
            text: "RFQ Description",
            selected: oSettings.description,
          },
          {
            key: "companyCode",
            text: "Company Code",
            selected: oSettings.companyCode,
          },
          {
            key: "purchOrg",
            text: "Purchasing Organization",
            selected: oSettings.purchOrg,
          },
          {
            key: "purchGroup",
            text: "Purchasing Group",
            selected: oSettings.purchGroup,
          },
        ];
      },

      // ========= Get Sort Fields Configuration =========
      _getSortFields: function () {
        return [
          { key: "Aedat", text: "Created On", selected: true },
          { key: "Ebeln", text: "RFQ Number", selected: false },
          { key: "Ktwrt", text: "Target Value", selected: false },
          { key: "Angdt", text: "Quotation Deadline", selected: true },
          { key: "Statu", text: "Status", selected: false },
        ];
      },

      // ========= Confirm View Settings =========
      onConfirmViewSettings: function (oEvent) {
        const mParams = oEvent.getParameters();
        const oViewModel = this.getView().getModel("view");

        // Handle Filter Items (RFQ Column Fields)
        if (mParams.filterItems && mParams.filterItems.length > 0) {
          const oFieldSettings = {};
          const aAllFields = this._getRFQColumnFields();

          aAllFields.forEach((field) => {
            const bSelected = mParams.filterItems.some(
              (item) => item.getKey() === field.key
            );
            oFieldSettings[field.key] =
              field.key === "rfqNumber" ? true : bSelected;
          });

          oViewModel.setProperty("/fieldSettings", oFieldSettings);
          localStorage.setItem(
            "rfqFieldSettings",
            JSON.stringify(
              Object.keys(oFieldSettings).map((key) => ({
                key: key,
                selected: oFieldSettings[key],
              }))
            )
          );

          const iSelectedFields = Object.values(oFieldSettings).filter(
            (v) => v
          ).length;
          MessageToast.show(
            `${iSelectedFields} fields displayed in RFQ column`
          );
        }

        // Handle Preset Filter Items (Table Columns)
        if (mParams.presetFilterItem) {
          const sKey = mParams.presetFilterItem.getKey();
          const oColumnSettings = oViewModel.getProperty("/columnSettings");

          // Toggle column visibility
          oColumnSettings[sKey] = !oColumnSettings[sKey];
          oViewModel.setProperty("/columnSettings", oColumnSettings);

          localStorage.setItem(
            "rfqColumnSettings",
            JSON.stringify(
              Object.keys(oColumnSettings).map((key) => ({
                key: key,
                selected: oColumnSettings[key],
              }))
            )
          );

          MessageToast.show(
            `Column "${mParams.presetFilterItem.getText()}" ${
              oColumnSettings[sKey] ? "shown" : "hidden"
            }`
          );
        }

        // Handle Sort
        if (mParams.sortItem) {
          const sPath = mParams.sortItem.getKey();
          const bDescending = mParams.sortDescending;
          const oTable = this.byId("rfqTable");
          const oBinding = oTable.getBinding("items");

          oBinding.sort(new Sorter(sPath, bDescending));
          MessageToast.show(
            `Sorted by ${mParams.sortItem.getText()} (${
              bDescending ? "Descending" : "Ascending"
            })`
          );
        }
      },

      // ========= Reset View Settings =========
      onResetViewSettings: function () {
        const oViewModel = this.getView().getModel("view");

        // Reset field settings
        const oDefaultFields = {
          rfqNumber: true,
          targetValue: true,
          deadline: true,
          status: true,
          createdOn: true,
          createdBy: true,

          companyCodeInRFQ: false,
          purchOrgInRFQ: false,
          purchGroupInRFQ: false,
        };

        // Reset column settings
        const oDefaultColumns = {
          description: true,
          companyCode: true,
          purchOrg: true,
          purchGroup: true,
        };

        oViewModel.setProperty("/fieldSettings", oDefaultFields);
        oViewModel.setProperty("/columnSettings", oDefaultColumns);

        localStorage.removeItem("rfqFieldSettings");
        localStorage.removeItem("rfqColumnSettings");

        MessageToast.show("Settings reset to default");
      },

      // ========= EXPORT TO EXCEL =========
      onExport: function () {
        const oTable = this.byId("rfqTable");
        const oBinding = oTable.getBinding("items");

        if (!oBinding || oBinding.getLength() === 0) {
          MessageBox.warning("No data available to export");
          return;
        }

        const aCols = this._createColumnConfig();
        const oSettings = {
          workbook: {
            columns: aCols,
            hierarchyLevel: "Level",
          },
          dataSource: oBinding,
          fileName: `RFQ_List_${new Date().toISOString().slice(0, 10)}.xlsx`,
          worker: false,
        };

        const oSheet = new Spreadsheet(oSettings);
        oSheet
          .build()
          .then(() => {
            MessageToast.show("Excel export completed");
          })
          .finally(() => {
            oSheet.destroy();
          });
      },

      _createColumnConfig: function () {
        return [
          { label: "RFQ No.", property: "Ebeln", type: EdmType.String },
          {
            label: "Target Value",
            property: "Ktwrt",
            type: EdmType.Number,
            scale: 2,
          },
          { label: "Currency", property: "Waers", type: EdmType.String },
          {
            label: "Quotation Deadline",
            property: "Angdt",
            type: EdmType.Date,
          },
          { label: "Status", property: "Statu", type: EdmType.String },
          { label: "Created On", property: "Aedat", type: EdmType.Date },
          { label: "Created By", property: "Ernam", type: EdmType.String },
          { label: "Description", property: "Txz01", type: EdmType.String },
          { label: "Company Code", property: "Bukrs", type: EdmType.String },
          {
            label: "Purchasing Organization",
            property: "Ekorg",
            type: EdmType.String,
          },
          {
            label: "Purchasing Group",
            property: "Ekgrp",
            type: EdmType.String,
          },
        ];
      },

      // ========= VALUE HELP HANDLERS =========
      onValueHelpRFQ: function (oEvent) {
        const aData = this.getView().getModel("rfq").getData() || [];
        const aRFQs = [...new Set(aData.map((i) => i.Ebeln))];
        this._createSimpleValueHelp(oEvent, "RFQ Number", "Ebeln", aRFQs);
      },

      onValueHelpErnam: function (oEvent) {
        const aData = this.getView().getModel("rfq").getData() || [];
        const aUsers = [...new Set(aData.map((i) => i.Ernam))];
        this._createSimpleValueHelp(oEvent, "Created By", "Ernam", aUsers);
      },

      onValueHelpBukrs: function (oEvent) {
        const aData = this.getView().getModel("rfq").getData() || [];
        const aBukrs = [...new Set(aData.map((i) => i.Bukrs))];
        this._createSimpleValueHelp(oEvent, "Company Code", "Bukrs", aBukrs);
      },

      onValueHelpEkorg: function (oEvent) {
        const aData = this.getView().getModel("rfq").getData() || [];
        const aEkorg = [...new Set(aData.map((i) => i.Ekorg))];
        this._createSimpleValueHelp(oEvent, "Purchasing Org", "Ekorg", aEkorg);
      },

      onValueHelpEkgrp: function (oEvent) {
        const aData = this.getView().getModel("rfq").getData() || [];
        const aEkgrp = [...new Set(aData.map((i) => i.Ekgrp))];
        this._createSimpleValueHelp(
          oEvent,
          "Purchasing Group",
          "Ekgrp",
          aEkgrp
        );
      },
    });
  }
);
