sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
  ],
  function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
    MessageToast,
    Spreadsheet,
    Table,
    Column
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.POList", {
      formatter: {
        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        formatReleaseStatusText: function (s) {
          switch (s) {
            // Approved
            case "R": // Released, no changes
            case "T": // PO Changeable
              return "Approved";

            // Pending
            case "0": // Changeable
            case "C": // Processing/Changeable
              return "Pending";

            // Rejected
            case "A":
              return "Rejected";

            // Others
            case "B": // Blocked, no changes
            case "G": // Blocked, no changes
            case "X": // Blocked
            default:
              return "Others";
          }
        },

        formatReleaseStatusState: function (s) {
          switch (s) {
            case "R":
            case "T":
              return "Success"; // Green

            case "0":
            case "C":
              return "Warning"; // Orange

            case "A":
              return "Error"; // Red

            default:
              return "None"; // Grey
          }
        },

        formatReleaseStatusIcon: function (s) {
          switch (s) {
            case "R":
            case "T":
              return "sap-icon://accept";

            case "0":
            case "C":
              return "sap-icon://pending";

            case "A":
              return "sap-icon://decline";

            default:
              return "sap-icon://document";
          }
        },
      },

      // ============================
      // INIT
      // ============================
      onInit: function () {
        // 🔥 Model riêng dùng cho PO, không dùng model global từ Component nữa
        this.oODataModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/"
          // {
          //   useBatch: false,
          //   defaultUpdateMethod: sap.ui.model.odata.UpdateMethod.PUT,
          //   json: true,
          // }
        );

        // Gán model cho view để binding UI
        this.getView().setModel(this.oODataModel);

        this.getView().setModel(new JSONModel(), "detailPO");
        this.getView().setModel(new JSONModel(), "po");
        this.getView().setModel(new JSONModel({ busy: false }), "view");

        this._createdDateSortState = 0;

        // ⭐ Khi vào lại route POList -> Reload + reset UI
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter
          .getRoute("POList")
          .attachPatternMatched(this._onRouteMatched, this);

        // Load PO List lần đầu
        this._loadPOList();
      },

      _onRouteMatched: function () {
        console.log("🔄 Route POList matched → reload + reset UI");

        // 1. Reload PO List
        this._loadPOList();

        // 2. Close PO detail panel
        const oDetail = this.byId("poDetailPanel");
        if (oDetail) {
          oDetail.setVisible(false);
        }

        // 3. Reset layout (full width)
        const oPane = this.byId("poTablePane");
        if (oPane) {
          const oLD = oPane.getLayoutData();
          if (oLD) oLD.setSize("100%");
        }

        // 4. Clear table selection
        const oTable = this.byId("poTable");
        if (oTable) {
          oTable.removeSelections(true);
        }

        // 5. Reset detailPO model
        const oDetailPO = this.getView().getModel("detailPO");
        if (oDetailPO) {
          oDetailPO.setData({});
        }

        // 6. Clear PO Note
        const oNoteModel = this.getView().getModel("poNoteModel");
        if (oNoteModel) {
          oNoteModel.setProperty("/Ebeln", "");
          oNoteModel.setProperty("/Note", "");
          oNoteModel.setProperty("/Editable", false);
          oNoteModel.setProperty("/CanEdit", true);
        }
      },

      // ============================
      // SELECT PO HEADER
      // ============================
      onSelectPO: function (oEvent) {
    const oSelectedItem = oEvent.getParameter("listItem");

    if (!oSelectedItem) {
        this.onCloseDetail();
        return;
    }

    const oPOData = oSelectedItem.getBindingContext("po").getObject();
    this.getView().getModel("detailPO").setData(oPOData);

    this.byId("poDetailPanel").bindElement("detailPO>/");
    this.byId("poDetailPanel").setVisible(true);

    // LEFT 60%
    this.byId("poTableLayout").setSize("75%");
    // RIGHT 40%
    this.byId("_IDGenSplitterLayoutData1").setSize("25%");

    const oItemTable = this.byId("tblPOItems");
    if (oItemTable) {
        oItemTable.removeSelections(true);
    }

    this._loadPONote(oPOData.Ebeln);
},


      onCloseDetail: function () {

    // Ẩn panel bên trong
    this.byId("poDetailPanel").setVisible(false);

    // LEFT FULL WIDTH
    this.byId("poTableLayout").setSize("100%");

    // RIGHT PANE WIDTH = 0% (rất quan trọng)
    this.byId("_IDGenSplitterLayoutData1").setSize("0%");

    // Reset chọn
    const oTable = this.byId("poTable");
    if (oTable) oTable.removeSelections(true);
},




      // ============================
      // ITEM CLICK (to detail screen)
      // ============================
      onItemPress: function (oEvent) {
        this.byId("poDetailPanel").setVisible(false);
        this.byId("poTablePane").getLayoutData().setSize("100%");

        const oItem = oEvent.getParameter("listItem");
        const oCtx = oItem.getBindingContext("detailPO");
        if (!oCtx) return;

        const oData = oCtx.getObject();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("POItemDetail", {
          Ebeln: oData.Ebeln,
          Ebelp: oData.Ebelp,
        });
      },

      onFilterSearch: function () {
        const oTable = this.byId("poTable");
        const aFilters = [];

        const oPO = this.byId("poFilter");
        const sPOtyped = oPO.getValue().trim();
        if (sPOtyped) {
          oPO.addToken(new sap.m.Token({ key: sPOtyped, text: sPOtyped }));
          oPO.setValue("");
        }

        const aPOTokens = oPO.getTokens();
        if (aPOTokens.length > 0) {
          const aPOFilters = aPOTokens.map(
            (t) =>
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                t.getKey()
              )
          );
          aFilters.push(new sap.ui.model.Filter(aPOFilters, false)); // OR
        }

        const oBsart = this.byId("orderTypeFilter");
        const sBsartTyped = oBsart.getValue().trim();
        if (sBsartTyped) {
          oBsart.addToken(
            new sap.m.Token({ key: sBsartTyped, text: sBsartTyped })
          );
          oBsart.setValue("");
        }

        const aBsartTokens = oBsart.getTokens();
        if (aBsartTokens.length > 0) {
          const aBsartFilters = aBsartTokens.map(
            (t) =>
              new sap.ui.model.Filter(
                "Bsart",
                sap.ui.model.FilterOperator.EQ,
                t.getKey()
              )
          );
          aFilters.push(new sap.ui.model.Filter(aBsartFilters, false));
        }

        const oEkgrp = this.byId("ekgrpFilterd");
        const sEkgrpTyped = oEkgrp.getValue().trim();
        if (sEkgrpTyped) {
          oEkgrp.addToken(
            new sap.m.Token({ key: sEkgrpTyped, text: sEkgrpTyped })
          );
          oEkgrp.setValue("");
        }

        const aEkgrpTokens = oEkgrp.getTokens();
        if (aEkgrpTokens.length > 0) {
          const aEkgrpFilters = aEkgrpTokens.map(
            (t) =>
              new sap.ui.model.Filter(
                "Ekgrp",
                sap.ui.model.FilterOperator.EQ,
                t.getKey()
              )
          );
          aFilters.push(new sap.ui.model.Filter(aEkgrpFilters, false));
        }

        const oErnam = this.byId("humanFilter");
        const sErnamTyped = oErnam.getValue().trim();
        if (sErnamTyped) {
          oErnam.addToken(
            new sap.m.Token({ key: sErnamTyped, text: sErnamTyped })
          );
          oErnam.setValue("");
        }

        const aErnamTokens = oErnam.getTokens();
        if (aErnamTokens.length > 0) {
          const aErnamFilters = aErnamTokens.map(
            (t) =>
              new sap.ui.model.Filter(
                "Ernam",
                sap.ui.model.FilterOperator.EQ,
                t.getKey()
              )
          );
          aFilters.push(new sap.ui.model.Filter(aErnamFilters, false));
        }

        // ====== CREATED DATE ======
        const oDateFrom = this.byId("dateFilter").getDateValue();
        const oDateTo = this.byId("dateFilter").getSecondDateValue();
        if (oDateFrom && oDateTo) {
          aFilters.push(
            new sap.ui.model.Filter(
              "Aedat",
              sap.ui.model.FilterOperator.BT,
              oDateFrom,
              oDateTo
            )
          );
        }

        // ====== STATUS ======
        const sStatus = this.byId("statusFilter").getSelectedKey();

        if (sStatus && sStatus !== "ALL") {
          let aStatusValues = [];

          switch (sStatus) {
            case "Approved":
              aStatusValues = ["R", "T"];
              break;

            case "Pending":
              aStatusValues = ["0", "C"];
              break;

            case "Rejected":
              aStatusValues = ["A"];
              break;

            case "Others":
              aStatusValues = ["B", "G", "X"];
              break;
          }

          if (aStatusValues.length > 0) {
            aFilters.push(
              new sap.ui.model.Filter(
                aStatusValues.map(
                  (v) => new sap.ui.model.Filter("Frgke", FilterOperator.EQ, v)
                ),
                false // OR
              )
            );
          }
        }

        // ===== APPLY TO TABLE ======
        oTable.getBinding("items").filter(aFilters);
      },

      onValueHelpPO: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        this._createSimpleValueHelp(
          oEvent,
          "PO Number",
          "Ebeln",
          aData.map((i) => i.Ebeln)
        );
      },

      onValueHelpOrderType: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aTypes = [...new Set(aData.map((i) => i.Bsart))];
        this._createSimpleValueHelp(oEvent, "Order Type", "Bsart", aTypes);
      },

      onValueHelpEkgrp: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aGroups = [...new Set(aData.map((i) => i.Ekgrp))];
        this._createSimpleValueHelp(oEvent, "Purch. Group", "Ekgrp", aGroups);
      },

      onValueHelpErnam: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aUsers = [...new Set(aData.map((i) => i.Ernam))];
        this._createSimpleValueHelp(oEvent, "Created By", "Ernam", aUsers);
      },

      onExportExcel: function () {
        const oTable = this.byId("poTable");
        const oModel = oTable.getModel("po"); // ⭐ dùng đúng model name
        const aData = oModel.getData() || []; // ⭐ lấy thẳng mảng

        if (!aData.length) {
          return MessageToast.show("⚠️ No data to export!");
        }

        const aCols = [
          { label: "Purchase Order", property: "Ebeln" },
          { label: "Order Type", property: "Bsart" },
          { label: "Purchasing Group", property: "Ekgrp" },
          { label: "Created By", property: "Ernam" },
          { label: "Created Date", property: "Aedat", type: "date" }, // ⭐ thêm type để Excel hiểu ngày
        ];

        const oSheet = new Spreadsheet({
          workbook: { columns: aCols },
          dataSource: aData,
          fileName: "PO_List_Export.xlsx",
        });

        oSheet
          .build()
          .then(() => MessageToast.show("✅ Export successful!"))
          .finally(() => oSheet.destroy());
      },

      onRefresh: function () {
        const oTable = this.byId("poTable");
        const oBinding = oTable.getBinding("items");

        if (oBinding) {
          oBinding.refresh();
        }

        MessageToast.show("🔄 Data refreshed");
      },
      onNavHome: function () {
        const oRouter = this.getOwnerComponent().getRouter();

        // Reset detail panel (nếu có)
        const oDetailPanel = this.byId("poDetailPanel");
        if (oDetailPanel) {
          oDetailPanel.setVisible(false);
        }

        // Clear selected item
        const oTable = this.byId("poTable");
        if (oTable) {
          oTable.removeSelections(true);
        }

        // Điều hướng về Dashboard
        oRouter.navTo("DashboardPR", {}, true); // replace history = true
      },

      // ============================
      // LOAD PO LIST
      _loadPOList: function () {
        sap.ui.core.BusyIndicator.show(0);

        const oModel = this.oODataModel;

        const pEket = new Promise((resolve, reject) => {
          oModel.read("/EKET001Set", {
            success: (d) => resolve(d.results),
            error: reject,
          });
        });

        pEket
          .then((aEket) => {
            // Không có EKET → không có PO tương ứng
            if (!aEket || aEket.length === 0) {
              this.getView().setModel(new JSONModel([]), "po");
              this._originalPOData = [];
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageToast.show("No PO found for selected PR list.");
              return null; // để skip bước Promise.all phía dưới
            }

            // STEP 2 — lấy list PO (Ebeln) duy nhất từ EKET
            const aPO = [...new Set(aEket.map((e) => e.Ebeln))];

            if (aPO.length === 0) {
              this.getView().setModel(new JSONModel([]), "po");
              this._originalPOData = [];
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageToast.show("No PO found for selected PR list.");
              return null;
            }

            // STEP 3 — tạo filter OR cho Ebeln
            const oPOFilter = new Filter({
              filters: aPO.map(
                (p) => new Filter("Ebeln", FilterOperator.EQ, p)
              ),
              and: false, // OR
            });

            console.log("opo: ", new Filter("Bstyp", FilterOperator.EQ, "F"));

            // STEP 4 — đọc ProcurementHeaderSet theo Ebeln + Bstyp = "F" (PO)
            const pHeader = new Promise((resolve, reject) => {
              oModel.read("/ProcurementHeaderSet", {
                filters: [
                  oPOFilter, // list Ebeln
                  new Filter("Bstyp", FilterOperator.EQ, "F"), // 🔥 chỉ PO
                ],
                success: (d) => resolve(d.results),
                error: reject,
              });
            });

            // STEP 5 — đọc ProcurementItemSet để merge Items
            const pItems = new Promise((resolve, reject) => {
              oModel.read("/ProcurementItemSet", {
                success: (d) => resolve(d.results),
                error: reject,
              });
            });

            return Promise.all([pHeader, pItems]);
          })
          .then((result) => {
            // Nếu ở trên đã return null thì bỏ qua
            if (!result) return;

            const [aHeader, aItems] = result;

            // Map Items theo Ebeln
            const mapItems = {};
            aItems.forEach((it) => {
              if (!mapItems[it.Ebeln]) {
                mapItems[it.Ebeln] = [];
              }
              mapItems[it.Ebeln].push(it);
            });

            // Enrich header: Items, ItemCount, TotalNetValue
            aHeader.forEach((h) => {
              const aIt = mapItems[h.Ebeln] || [];
              h.Items = aIt;
              h.ItemCount = aIt.length;
              h.TotalNetValue = aIt
                .reduce((s, it) => s + (parseFloat(it.Netwr) || 0), 0)
                .toFixed(2);
            });

            // Gán model cho view "po" (binding hiện tại của bạn)
            const oPOModel = new JSONModel(aHeader);
            this.getView().setModel(oPOModel, "po");

            // Lưu lại bản gốc để reset sort
            this._originalPOData = JSON.parse(JSON.stringify(aHeader));

            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show(
              `${aHeader.length} POs loaded (mapped from EKET)`
            );
          })
          .catch((err) => {
            console.error("Error loading PO list from EKET:", err);
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Failed to load PO list (EKET-based).");
          });
      },

      _createSimpleValueHelp: function (oEvent, sTitle, sKey, aValues) {
        // Convert values -> [{ key: "..."}]
        const aRows = aValues.map((v) => {
          let obj = {};
          obj[sKey] = v;
          return obj;
        });

        const oRowsModel = new sap.ui.model.json.JSONModel({ rows: aRows });

        // ===== TABLE =====
        const oTable = new sap.ui.table.Table({
          visibleRowCount: 12,
          selectionMode: "MultiToggle",
          columns: [
            new sap.ui.table.Column({
              width: "180px",
              label: new sap.m.Label({ text: sTitle }),
              template: new sap.m.Text({ text: `{${sKey}}` }),
            }),
          ],
        });

        oTable.setModel(oRowsModel);
        oTable.bindRows("/rows");

        // ===== SEARCH FIELD =====
        const oSearch = new sap.m.SearchField({
          width: "100%",
          placeholder: "Search...",
          liveChange: (e) => {
            const q = (e.getParameter("newValue") || "").toUpperCase();

            const filtered = aRows.filter((r) =>
              String(r[sKey]).toUpperCase().includes(q)
            );

            // Cập nhật model khi search
            oRowsModel.setData({ rows: filtered });
          },
        });

        // ===== FILTER BAR =====
        const oFilterBar = new sap.ui.comp.filterbar.FilterBar({
          advancedMode: false,
          filterGroupItems: [],
          basicSearch: oSearch,
        });

        // ===== DIALOG =====
        const oMI = oEvent.getSource();
        const oVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
          title: sTitle,
          key: sKey,
          supportMultiselect: true,
          supportRanges: false,
          supportRangesOnly: false,

          ok: () => {
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

          cancel: () => oVH.close(),
        });

        // Áp dụng FilterBar & Table cho VHD
        oVH.setFilterBar(oFilterBar);

        // phải dùng oVH.setTable() cho Smart ValueHelpDialog
        oVH.setTable(oTable);

        oVH.open();
      },

      // ====================================================
      // 📝 MANAGER NOTE (PO)
      // ====================================================
      _loadPONote: function (sEbeln) {
        console.log("📡 Loading note for PO:", sEbeln);

        const oModel = this.getView().getModel();
        const oNoteModel =
          this.getView().getModel("poNoteModel") ||
          new sap.ui.model.json.JSONModel({
            Ebeln: sEbeln,
            Note: "",
            Editable: false,
            CanEdit: true, // ✅ Mặc định: ai cũng có thể edit
          });
        this.getView().setModel(oNoteModel, "poNoteModel");

        const sKeyEbeln = String(sEbeln || "")
          .trim()
          .padStart(10, "0");
        oNoteModel.setProperty("/Ebeln", sKeyEbeln);
        oNoteModel.setProperty("/Note", "Loading...");
        oNoteModel.setProperty("/Editable", false);
        oNoteModel.setProperty("/CanEdit", true); // ✅ Luôn true

        sap.ui.core.BusyIndicator.show(0);

        // Không cần lấy user nữa vì ai cũng có quyền
        oModel.read(`/PONoteSet(Ebeln='${sKeyEbeln}')`, {
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();
            oNoteModel.setProperty(
              "/Note",
              oData.Note || "— No note available —"
            );
            oNoteModel.setProperty("/CanEdit", true); // ✅ Giữ luôn true
            console.log("✅ PO note loaded, edit enabled for all users");
          },
          error: (err) => {
            sap.ui.core.BusyIndicator.hide();
            oNoteModel.setProperty("/Note", "— No note available —");
            oNoteModel.setProperty("/CanEdit", true); // ✅ Cho phép edit cả khi chưa có note
            console.warn("⚠️ Cannot load PO note:", err);
          },
        });
      },

      onCloseDetail: function () {
        this.byId("poDetailPanel").setVisible(false);
        this.byId("poTablePane").getLayoutData().setSize("100%");
        this.byId("poTable").removeSelections(true);
      },

      onEditNotePo: function () {
        const oNoteModel = this.getView().getModel("poNoteModel");
        if (!oNoteModel) return;
        oNoteModel.setProperty("/Editable", true);
        MessageToast.show("✏️ Edit mode enabled for PO note.");
      },

      onCancelEditNotePo: function () {
        const oNoteModel = this.getView().getModel("poNoteModel");
        if (!oNoteModel) return;
        oNoteModel.setProperty("/Editable", false);
        MessageToast.show("❌ Edit cancelled.");
      },

      onSaveNotePo: function () {
        const oModel = this.getView().getModel();
        const oNoteModel = this.getView().getModel("poNoteModel");

        const sEbeln = oNoteModel.getProperty("/Ebeln");
        const sNote = oNoteModel.getProperty("/Note");
        if (!sEbeln) return MessageToast.show("⚠️ No PO selected.");

        const oEntry = { Ebeln: sEbeln, Note: sNote };

        sap.ui.core.BusyIndicator.show(0);

        oModel.read(`/PONoteSet(Ebeln='${sEbeln}')`, {
          success: () => {
            oModel.update(`/PONoteSet(Ebeln='${sEbeln}')`, oEntry, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("✅ PO note updated successfully!");
                oNoteModel.setProperty("/Editable", false);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error("❌ Update failed:", err);
                MessageToast.show("❌ Failed to update note.");
              },
            });
          },
          error: () => {
            oModel.create("/PONoteSet", oEntry, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("✅ PO note created successfully!");
                oNoteModel.setProperty("/Editable", false);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error("❌ Create failed:", err);
                MessageToast.show("❌ Failed to create note.");
              },
            });
          },
        });
      },

      onApprovePO: function () {
        const oPO = this.getView().getModel("detailPO").getData();
        const sEbeln = String(oPO.Ebeln).padStart(10, "0");

        MessageBox.confirm(`Approve PO ${sEbeln}?`, {
          onClose: (sAction) => {
            if (sAction !== MessageBox.Action.OK) return;

            sap.ui.core.BusyIndicator.show(0);

            const oModel = this.oODataModel;

            const sPath = `/ProcurementHeaderSet(Ebeln='${sEbeln}')`;

            const oPayload = {
              Ebeln: sEbeln,
              Frgke: "R", // 🎯 Approved for header
            };

            oModel.update(sPath, oPayload, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success(`PO ${sEbeln} approved!`);
                this._refreshPOAfterAction(sEbeln);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error(err);
                MessageBox.error("Failed to approve PO.");
              },
            });
          },
        });
      },

      onRejectPO: function () {
        const oPO = this.getView().getModel("detailPO").getData();
        const sEbeln = String(oPO.Ebeln).padStart(10, "0");

        MessageBox.confirm(`Reject PO ${sEbeln}?`, {
          onClose: (sAction) => {
            if (sAction !== MessageBox.Action.OK) return;

            sap.ui.core.BusyIndicator.show(0);

            const oModel = this.oODataModel;

            const sPath = `/ProcurementHeaderSet(Ebeln='${sEbeln}')`;

            const oPayload = {
              Ebeln: sEbeln,
              Frgke: "A", // ❌ Rejected
            };

            oModel.update(sPath, oPayload, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success(`PO ${sEbeln} rejected!`);
                this._refreshPOAfterAction(sEbeln);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error(err);
                MessageBox.error("Failed to reject PO.");
              },
            });
          },
        });
      },

      onSortCreatedDate: function () {
        const oTable = this.byId("poTable");
        const oBinding = oTable.getBinding("items");

        // Tăng trạng thái: 0 → 1 → 2 → 0
        this._createdDateSortState = (this._createdDateSortState + 1) % 3;

        let aSorters = [];

        if (this._createdDateSortState === 1) {
          // ASC
          aSorters.push(new sap.ui.model.Sorter("Aedat", false));
          MessageToast.show("🔼 Sorted by Created Date (Ascending)");
        } else if (this._createdDateSortState === 2) {
          // DESC
          aSorters.push(new sap.ui.model.Sorter("Aedat", true));
          MessageToast.show("🔽 Sorted by Created Date (Descending)");
        } else {
          // ⛔ RESET VỀ THỨ TỰ GỐC
          const oOriginalModel = new JSONModel(this._originalPOData);
          this.getView().setModel(oOriginalModel, "po");

          MessageToast.show("↩️ Sort reset (Back to original order)");
          return;
        }

        // Apply sorting
        oBinding.sort(aSorters);
      },

      _refreshPOAfterAction: function (sEbeln) {
        const oModel = this.getView().getModel();

        // Refresh PO header + items
        sap.ui.core.BusyIndicator.show(0);

        const pHeader = new Promise((resolve, reject) => {
          oModel.read("/ProcurementHeaderSet", {
            filters: [
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                sEbeln
              ),
            ],
            success: (d) => resolve(d.results[0]),
            error: reject,
          });
        });

        const pItems = new Promise((resolve, reject) => {
          oModel.read("/ProcurementItemSet", {
            filters: [
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                sEbeln
              ),
            ],
            success: (d) => resolve(d.results),
            error: reject,
          });
        });

        Promise.all([pHeader, pItems])
          .then(([header, items]) => {
            sap.ui.core.BusyIndicator.hide();
            if (!header) return;

            header.Items = items || [];
            header.ItemCount = header.Items.length;

            this.getView().getModel("detailPO").setData(header);

            MessageToast.show(`🔄 PO ${sEbeln} refreshed successfully`);
          })
          .catch(() => {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("⚠️ Cannot refresh PO details.");
          });
      },

      onGoToDashboard: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("DashboardPR");
      },

      onGoToPRList: function () {
        this.getOwnerComponent().getRouter().navTo("PRList");
      },
      onGoToRFQList: function () {
        this.getOwnerComponent().getRouter().navTo("RFQList");
      },
    });
  }
);
