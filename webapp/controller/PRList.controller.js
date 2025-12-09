sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
  ],
  function (
    Controller,
    ODataModel,
    MessageToast,
    MessageBox,
    Spreadsheet,
    JSONModel,
    Filter,
    FilterOperator,
    Table,
    Column
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.PRList", {
      // =========================================================
      // FORMATTERS
      // =========================================================
      formatter: {
        statusText: function (sFrgkz, sReason) {
          // ⭐ Reject logic: C + có ReasonId => Rejected
          if (sFrgkz === "C" && sReason) return "Rejected";

          switch (sFrgkz) {
            case "R":
              return "Approved";
            case "C":
              return "Pending";
            case "X":
              return "Rejected";
            default:
              return "";
          }
        },

        statusState: function (sFrgkz, sReason) {
          // ⭐ C + ReasonId => Error (đỏ)
          if (sFrgkz === "C" && sReason) return "Error";

          switch (sFrgkz) {
            case "R":
              return "Success";
            case "C":
              return "None";
            case "X":
              return "Error";
            default:
              return "None";
          }
        },

        // Tooltip cho status (C)
        statusTooltip: function (sFrgkz, sReason) {
          if (sFrgkz === "C" && sReason) {
            return "Rejected. Reason ID: " + sReason;
          }
          return "";
        },

        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        padBanfn: function (sBanfn) {
          if (!sBanfn) return "";
          return String(sBanfn).trim().padStart(10, "0");
        },

        docTypeText: function (sBsart) {
          if (!sBsart) return "";
          const map = {
            NB: "Purchase Requisition",
            ZNB1: "Service PR Type 1",
            ZNB2: "Service PR Type 2",
            ZNB3: "Maintenance PR",
            ZNB4: "Material Request",
            ZNB5: "Internal Purchase",
            ZNB6: "Stock PR",
            ZNB7: "Subcontracting PR",
            ZNB8: "External Purchase",
            ZNB9: "Repair PR",
            AN: "Quotation Request",
            UB: "Stock Transfer",
          };
          const desc = map[sBsart] || "Unknown Type";
          return desc + " (" + sBsart + ")";
        },

        quantityFormat: function (value) {
          if (value === undefined || value === null || value === "") return "";
          const num = parseFloat(value);
          if (isNaN(num)) return value;
          return num % 1 === 0 ? num.toString() : num.toFixed(3);
        },

        reasonText: function (sReason) {
          if (!sReason) return "";
          const map = {
            "00": "Incorrect quantity requested",
            "01": "Budget not approved",
            "02": "Material not required anymore",
            "03": "Duplicate purchase requisition",
            "04": "Incorrect material number",
            "05": "Wrong plant or storage location",
            "06": "Pricing information is incorrect",
            "07": "Missing technical specification",
            "08": "Vendor issue or restriction",
            "09": "Request requires further review",
            "12": "None"
          };
          return sReason + " – " + (map[sReason] || "");
      }

      },

      // ⭐ Danh sách lý do reject (demo – bạn chỉnh theo master data của bạn)
      _aRejectReasons: [
        { key: "00", text: "Incorrect quantity requested" },
        { key: "01", text: "Budget not approved" },
        { key: "02", text: "Material not required anymore" },
        { key: "03", text: "Duplicate purchase requisition" },
        { key: "04", text: "Incorrect material number" },
        { key: "05", text: "Wrong plant or storage location" },
        { key: "06", text: "Pricing information is incorrect" },
        { key: "07", text: "Missing technical specification" },
        { key: "08", text: "Vendor issue or restriction" },
        { key: "09", text: "Request requires further review" },
        { key: "12", text: "None" },
      ],

      // =========================================================
      // INIT
      // =========================================================
      onInit: function () {
        const sServiceUrl = "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/";
        const oModel = new ODataModel(sServiceUrl, {
          useBatch: false,
          json: true,
          defaultUpdateMethod: sap.ui.model.odata.UpdateMethod.PUT,
        });

        this.getView().setModel(oModel);
        this.byId("detailPanel").setVisible(false);
        this._loadCaches();

        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter
          .getRoute("PRList")
          .attachPatternMatched(this._onRouteMatched, this);
        this.onGoFilter();
      },

      _onRouteMatched: function () {
        // ⭐ 1. Kiểm tra nếu quay lại từ màn PR Item Detail
        if (sessionStorage.getItem("PR_BACK_FROM_DETAIL") === "1") {
          console.log("⏳ Back from PR Item Detail → SKIP reload");

          // Xóa flag sau khi sử dụng
          sessionStorage.removeItem("PR_BACK_FROM_DETAIL");

          // Chỉ reset UI (đóng panel detail)
          const oDetail = this.byId("detailPanel");
          if (oDetail) oDetail.setVisible(false);

          const oLayout = this.byId("layoutMaster");
          if (oLayout) oLayout.setSize("100%");

          const oTable = this.byId("tblPRList");
          if (oTable) oTable.removeSelections();

          return; // ⭐ STOP — tránh reload PR List
        }

        // ⭐ 2. Các trường hợp khác (Dashboard → PR List) → Reload
        console.log("🔄 From Dashboard → Reload PR List");
        this.onGoFilter();

        // Reset UI
        const oDetail = this.byId("detailPanel");
        if (oDetail) oDetail.setVisible(false);

        const oLayout = this.byId("layoutMaster");
        if (oLayout) oLayout.setSize("100%");

        const oTable = this.byId("tblPRList");
        if (oTable) oTable.removeSelections();

        const oNoteModel = this.getView().getModel("noteModel");
        if (oNoteModel) {
          oNoteModel.setProperty("/Note", "");
          oNoteModel.setProperty("/Banfn", "");
          oNoteModel.setProperty("/Editable", false);
        }
      },

      _createSimpleValueHelp: function (oMI, sTitle, sKey, aValues) {
        const aRows = aValues.map((v) => {
          let obj = {};
          obj[sKey] = v;
          return obj;
        });

        const oRowsModel = new sap.ui.model.json.JSONModel({ rows: aRows });

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

        const oSearch = new sap.m.SearchField({
          width: "100%",
          placeholder: "Search...",
          liveChange: (e) => {
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

        const oVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
          title: sTitle,
          key: sKey,
          supportMultiselect: true,
          supportRanges: false,

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

        oVH.setFilterBar(oFilterBar);
        oVH.setTable(oTable);
        oVH.open();
      },

      // =========================================================
      // FILTER + GROUP
      // =========================================================
      onGoFilter: function () {
        const oView = this.getView();
        const oModel = oView.getModel();
        const oTable = oView.byId("tblPRList");
        const aFilters = [];

        function handleTokenInput(id, field) {
          const oInput = oView.byId(id);
          const typed = oInput.getValue().trim();
          if (typed) {
            oInput.addToken(new sap.m.Token({ key: typed, text: typed }));
            oInput.setValue("");
          }
          const tokens = oInput
            .getTokens()
            .map((t) => new Filter(field, FilterOperator.EQ, t.getKey()));
          if (tokens.length) aFilters.push(new Filter(tokens, false));
        }

        handleTokenInput("inpBanfn", "Banfn");
        handleTokenInput("inpBsart", "Bsart");
        handleTokenInput("inpEkgrp", "Ekgrp");
        handleTokenInput("inpErnam", "Ernam");

        const oDR = oView.byId("inpDateRange");
        const dFrom = oDR.getDateValue();
        const dTo = oDR.getSecondDateValue();

        if (dFrom && dTo) {
          aFilters.push(new Filter("Badat", FilterOperator.BT, dFrom, dTo));
        }

        const sStatus = this.byId("inpStatus").getSelectedKey();
        if (sStatus && sStatus !== "") {
          aFilters.push(new Filter("Frgkz", FilterOperator.EQ, sStatus));
        }

        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          filters: aFilters,
          urlParameters: { $top: 10000 },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();

            const groups = [];

            // ⭐ Map REASON_ID → ReasonId để view dùng
            data.results.forEach((r) => {
              if (r.REASON_ID !== undefined && r.REASON_ID !== null) {
                r.ReasonId = r.REASON_ID;
              } else {
                r.ReasonId = "";
              }

              let g = groups.find((e) => e.Banfn === r.Banfn);
              if (!g) {
                g = {
                  Banfn: r.Banfn,
                  Bsart: r.Bsart,
                  Ekgrp: r.Ekgrp,
                  Ernam: r.Ernam,
                  Badat: r.Badat,
                  Frgkz: r.Frgkz,
                  ReasonId: "", // sẽ tính sau theo items
                  Items: [],
                };
                groups.push(g);
              }
              g.Items.push(r);
            });

            // ⭐ Tính trạng thái group theo Items:
            groups.forEach((g) => {
              g.ItemCount = g.Items.length;

              const oRejected = g.Items.find(
                (it) => it.Frgkz === "C" && it.ReasonId
              );
              const oApproved = g.Items.find((it) => it.Frgkz === "R");

              if (oRejected) {
                g.Frgkz = "C";
                g.ReasonId = oRejected.ReasonId;
              } else if (oApproved) {
                g.Frgkz = "R";
                g.ReasonId = "";
              } else {
                g.Frgkz = "C";
                g.ReasonId = "";
              }
            });

            oTable.setModel(new JSONModel({ groups }));
            MessageToast.show(`${groups.length} PR found`);
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("⚠️ Error loading data");
          },
        });
      },

      // =========================================================
      // CLEAR FILTER
      // =========================================================
      onClearFilter: function () {
        const oView = this.getView();

        ["inpBanfn", "inpBsart", "inpEkgrp", "inpErnam"].forEach(function (id) {
          const oInp = oView.byId(id);
          if (oInp) {
            oInp.setValue("");
            oInp.data("selectedKey", "");
            oInp.removeAllTokens && oInp.removeAllTokens();
          }
        });

        const oDateRange = oView.byId("inpDateRange");
        if (oDateRange) {
          oDateRange.setValue("");
        }

        this.onGoFilter();
        MessageToast.show("🔄 Filters cleared.");
      },

      // =========================================================
      // DETAIL PANEL
      // =========================================================
      onSelectPR: function (oEvent) {
        const oItem = oEvent.getParameter("listItem");
        if (!oItem) return;

        const oCtx = oItem.getBindingContext();
        const group = oCtx.getObject();
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        const oModel = this.getView().getModel();

        // ⭐ XÓA MODEL CŨ TRÊN DETAIL PANEL
        oDetail.setModel(null);

        const sBanfn = group.Banfn;
        const sKeyBanfn = String(sBanfn).padStart(10, "0");

        // NOTE MODEL
        const oNoteModel = new sap.ui.model.json.JSONModel({
          Banfn: sKeyBanfn,
          Note: "Loading...",
          Editable: false,
        });
        this.getView().setModel(oNoteModel, "noteModel");

        // DETAIL MODEL
        const oDetailModel = new sap.ui.model.json.JSONModel({
          Banfn: group.Banfn,
          Bsart: group.Bsart,
          Ekgrp: group.Ekgrp,
          Ernam: group.Ernam,
          Badat: group.Badat,
          Frgkz: group.Frgkz,
          ReasonId: group.ReasonId || "",
          Items: [],
        });

        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          filters: [
            new sap.ui.model.Filter(
              "Banfn",
              sap.ui.model.FilterOperator.EQ,
              sKeyBanfn
            ),
          ],
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();

            const aItems = oData.results || [];

            // ⭐ Map REASON_ID → ReasonId cho Items
            aItems.forEach((it) => {
              if (it.REASON_ID !== undefined && it.REASON_ID !== null) {
                it.ReasonId = it.REASON_ID;
              } else {
                it.ReasonId = "";
              }
            });

            oDetailModel.setProperty("/Items", aItems);

            // ⭐ Tính header Frgkz + ReasonId từ items
            let sHeaderFrgkz = group.Frgkz;
            let sHeaderReason = group.ReasonId || "";

            const oRejected = aItems.find(
              (it) => it.Frgkz === "C" && it.ReasonId
            );
            const oApproved = aItems.find((it) => it.Frgkz === "R");

            if (oRejected) {
              sHeaderFrgkz = "C";
              sHeaderReason = oRejected.ReasonId;
            } else if (oApproved) {
              sHeaderFrgkz = "R";
              sHeaderReason = "";
            } else {
              sHeaderFrgkz = "C";
              sHeaderReason = "";
            }

            oDetailModel.setProperty("/Frgkz", sHeaderFrgkz);
            oDetailModel.setProperty("/ReasonId", sHeaderReason);

            // ⭐ SET MODEL + BIND ELEMENT
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");

            oDetail.setVisible(true);
            oLayout.setSize("72%");

            const oItemTable = this.byId("tblPRItems");
            if (oItemTable) oItemTable.setModel(oDetailModel);

            this._loadPRNote(sKeyBanfn);
          },

          error: () => {
            sap.ui.core.BusyIndicator.hide();

            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");

            oDetail.setVisible(true);
            oLayout.setSize("60%");

            this._loadPRNote(sKeyBanfn);
          },
        });
      },

      onCloseDetail: function () {
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        oDetail.setVisible(false);
        oLayout.setSize("100%");
        this.byId("tblPRList").removeSelections();
      },

      onSelectItem: function (oEvent) {
        const oSelectedItem = oEvent.getParameter("listItem");
        const oCtx = oSelectedItem.getBindingContext();
        if (!oCtx) return;

        const oItemData = oCtx.getObject();
        const oDetailPanelModel = this.byId("detailPanel").getModel();
        let sBanfn = oDetailPanelModel.getProperty("/Banfn");
        let sBnfpo = oItemData.Bnfpo;

        if (sBanfn) {
          sBanfn = sBanfn.toString().padStart(10, "0");
        }
        if (sBnfpo) {
          sBnfpo = sBnfpo.toString().padStart(5, "0");
        }

        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("PRItemDetail", {
          Banfn: sBanfn,
          Bnfpo: sBnfpo,
        });
      },

      onCloseDetail: function () {
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        oDetail.setVisible(false);
        oLayout.setSize("100%");
        this.byId("tblPRList").removeSelections();
      },

      // =========================================================
      // APPROVE ALL PENDING ITEMS
      // =========================================================
      onApprovePR: function () {
        const oDetail = this.byId("detailPanel");
        const oDetailModel = oDetail.getModel();
        const aItems = oDetailModel ? oDetailModel.getProperty("/Items") : [];
        const sBanfn = oDetailModel ? oDetailModel.getProperty("/Banfn") : "";

        if (!aItems.length) {
          return MessageToast.show("⚠️ No items to approve.");
        }

        // chỉ approve được trạng thái C (dù có ReasonId hay không)
        const aPendingItems = aItems.filter((it) => it.Frgkz === "C");

        const aLockedItems = aItems.filter((it) => it.Frgkz !== "C");

        if (aPendingItems.length === 0) {
          return MessageToast.show("ℹ️ All items already processed.");
        }

        MessageBox.confirm(
          "Approve " +
            aPendingItems.length +
            " pending item(s) for PR " +
            sBanfn +
            "?",
          {
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) return;

              sap.ui.core.BusyIndicator.show(0);
              const oModel = this.getView().getModel();

              oModel.setHeaders({
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
              });
              oModel.refreshSecurityToken();

              let iSuccess = 0;
              let iFail = 0;

              const processItems = function (items, index) {
                if (index >= items.length) {
                  sap.ui.core.BusyIndicator.hide();
                  let sMsg = "Approved " + iSuccess + " item(s).";
                  if (iFail > 0) {
                    sMsg += " " + iFail + " failed.";
                  }
                  if (aLockedItems.length > 0) {
                    sMsg += " Skipped " + aLockedItems.length + " locked.";
                  }
                  MessageBox.success(sMsg);
                  this._refreshAfterAction(
                    String(sBanfn).toString().padStart(10, "0")
                  );
                  return;
                }

                const item = items[index];
                const sBanfnPadded = String(item.Banfn).padStart(10, "0");
                const sBnfpoPadded = String(item.Bnfpo).padStart(5, "0");
                const sPath =
                  "/PRSet(Banfn='" +
                  sBanfnPadded +
                  "',Bnfpo='" +
                  sBnfpoPadded +
                  "')";
                const oPayload = {
                  Banfn: sBanfnPadded,
                  Bnfpo: sBnfpoPadded,
                  Frgkz: "R",
                };

                oModel.update(sPath, oPayload, {
                  success: function () {
                    iSuccess++;
                    processItems.call(this, items, index + 1);
                  }.bind(this),
                  error: function () {
                    iFail++;
                    processItems.call(this, items, index + 1);
                  }.bind(this),
                });
              }.bind(this);

              processItems(aPendingItems, 0);
            }.bind(this),
          }
        );
      },

      // =========================================================
      // REJECT ALL APPROVED ITEMS (R → C) + chọn Reason
      // =========================================================
      onRejectPR: function () {
        const oDetail = this.byId("detailPanel");
        const oDetailModel = oDetail.getModel();
        const aItems = oDetailModel ? oDetailModel.getProperty("/Items") : [];
        const sBanfn = oDetailModel ? oDetailModel.getProperty("/Banfn") : "";

        if (!aItems.length) {
          return sap.m.MessageToast.show("⚠️ No items to reject.");
        }

        // chỉ reject được trạng thái R
        const aPendingItems = aItems.filter((it) => it.Frgkz === "R");
        const aLockedItems = aItems.filter((it) => it.Frgkz !== "R");

        if (aPendingItems.length === 0) {
          return sap.m.MessageToast.show("ℹ️ All items already processed.");
        }

        // ⭐ Popup chọn Reason
        const oSelect = new sap.m.Select({
          width: "100%",
        });

        this._aRejectReasons.forEach(function (r) {
          oSelect.addItem(
            new sap.ui.core.Item({
              key: r.key,
              text: r.key + " - " + r.text,
            })
          );
        });

        const oDialog = new sap.m.Dialog({
          title: "Reject items for PR " + sBanfn,
          contentWidth: "400px",
          type: "Message",
          content: [
            new sap.m.VBox({
              items: [
                new sap.m.Text({
                  text:
                    "Select reject reason for " +
                    aPendingItems.length +
                    " item(s):",
                }),
                oSelect,
              ],
            }),
          ],
          beginButton: new sap.m.Button({
            text: "Reject",
            type: "Reject",
            press: function () {
              const sReason = oSelect.getSelectedKey();
              if (!sReason) {
                sap.m.MessageToast.show("⚠️ Please select a reason.");
                return;
              }

              oDialog.close();
              this._executeRejectItems(
                aPendingItems,
                aLockedItems,
                sBanfn,
                sReason
              );
            }.bind(this),
          }),
          endButton: new sap.m.Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
            },
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      // ⭐ Hàm thực thi reject sau khi đã chọn reason
      _executeRejectItems: function (
        aPendingItems,
        aLockedItems,
        sBanfn,
        sReason
      ) {
        const oModel = this.getView().getModel();
        sap.ui.core.BusyIndicator.show(0);

        oModel.setHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        });
        oModel.refreshSecurityToken();

        let iSuccess = 0;
        let iFail = 0;

        const processItems = function (items, index) {
          if (index >= items.length) {
            sap.ui.core.BusyIndicator.hide();

            let sMsg = "Rejected " + iSuccess + " item(s).";
            if (iFail > 0) {
              sMsg += " " + iFail + " failed.";
            }
            if (aLockedItems.length > 0) {
              sMsg += " Skipped " + aLockedItems.length + " locked.";
            }

            sap.m.MessageBox.success(sMsg);
            this._refreshAfterAction(String(sBanfn).padStart(10, "0"));
            return;
          }

          const item = items[index];

          const sBanfnPadded = String(item.Banfn).padStart(10, "0");
          const sBnfpoPadded = String(item.Bnfpo).padStart(5, "0");

          const sPath =
            "/PRSet(Banfn='" + sBanfnPadded + "',Bnfpo='" + sBnfpoPadded + "')";

          const oPayload = {
            Banfn: sBanfnPadded,
            Bnfpo: sBnfpoPadded,
            Frgkz: "C", // ❗ REJECT FLAG
            REASON_ID: sReason, // gửi Reason_ID cho backend
          };

          oModel.update(sPath, oPayload, {
            success: function () {
              iSuccess++;
              processItems.call(this, items, index + 1);
            }.bind(this),
            error: function () {
              iFail++;
              processItems.call(this, items, index + 1);
            }.bind(this),
          });
        }.bind(this);

        processItems(aPendingItems, 0);
      },

      // =========================================================
      // REFRESH AFTER ACTION
      // =========================================================
      _refreshAfterAction: function (sBanfn) {
        const oModel = this.getView().getModel();
        const oDetail = this.byId("detailPanel");

        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          filters: [
            new sap.ui.model.Filter(
              "Banfn",
              sap.ui.model.FilterOperator.EQ,
              sBanfn
            ),
          ],
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();

            const aItems = oData.results || [];

            // Map REASON_ID -> ReasonId trong Items
            aItems.forEach((it) => {
              it.ReasonId =
                it.REASON_ID !== undefined && it.REASON_ID !== null
                  ? it.REASON_ID
                  : "";
            });

            // Tính header từ item đầu + logic reject
            const first = aItems[0] || {};
            let sHeaderFrgkz = first.Frgkz || "C";
            let sHeaderReason = first.ReasonId || "";

            const oRejected = aItems.find(
              (it) => it.Frgkz === "C" && it.ReasonId
            );
            const oApproved = aItems.find((it) => it.Frgkz === "R");

            if (oRejected) {
              sHeaderFrgkz = "C";
              sHeaderReason = oRejected.ReasonId;
            } else if (oApproved) {
              sHeaderFrgkz = "R";
              sHeaderReason = "";
            } else {
              sHeaderFrgkz = "C";
              sHeaderReason = "";
            }

            const oDetailModel = new sap.ui.model.json.JSONModel({
              Banfn: sBanfn,
              Bsart: first.Bsart || "",
              Ekgrp: first.Ekgrp || "",
              Ernam: first.Ernam || "",
              Badat: first.Badat || null,
              Frgkz: sHeaderFrgkz,
              ReasonId: sHeaderReason,
              Items: aItems,
            });

            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            MessageToast.show("🔄 PR refreshed");
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("⚠ Failed to refresh PR.");
          },
        });
      },

      // =========================================================
      // EXPORT TO EXCEL
      // =========================================================
      onExportExcel: function () {
        const oTable = this.byId("tblPRList");
        const oModel = oTable.getModel();
        const aData = oModel && oModel.getData() ? oModel.getData().groups : [];

        if (!aData.length) {
          return MessageToast.show("⚠️ No data to export!");
        }

        const aCols = [
          { label: "Purchase Requisition", property: "Banfn" },
          { label: "Document Type", property: "Bsart" },
          { label: "Purchasing Group", property: "Ekgrp" },
          { label: "Created By", property: "Ernam" },
          { label: "Requisition Date", property: "Badat" },
        ];

        const oSheet = new Spreadsheet({
          workbook: { columns: aCols },
          dataSource: aData,
          fileName: "PR_List_Export.xlsx",
        });

        oSheet
          .build()
          .then(function () {
            MessageToast.show("✅ Export successful!");
          })
          .finally(function () {
            oSheet.destroy();
          });
      },

      // =========================================================
      // LOAD VALUE HELP CACHES
      // =========================================================
      _loadCaches: function () {
        const oModel = this.getView().getModel();

        oModel.read("/DocTypeSet", {
          success: function (d) {
            this._oDocTypeCache = new JSONModel(d.results);
          }.bind(this),
          error: function () {
            console.warn("DocTypeSet not loaded");
          },
        });

        oModel.read("/PurchGroupSet", {
          success: function (d) {
            this._oPurchGroupCache = new JSONModel(d.results);
          }.bind(this),
          error: function () {
            console.warn("PurchGroupSet not loaded");
          },
        });

        oModel.read("/UserSet", {
          success: function (d) {
            this._oUserCache = new JSONModel(d.results);
          }.bind(this),
          error: function () {
            console.warn("UserSet not loaded");
          },
        });
      },

      // =========================================================
      // VALUE HELP DIALOGS
      // =========================================================
      onValueHelpBanfn: function (oEvent) {
        const oMI = oEvent.getSource(); // chính xác MultiInput

        const oModel = this.getView().getModel();
        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          urlParameters: { $top: 5000 },
          success: (d) => {
            sap.ui.core.BusyIndicator.hide();
            const a = [
              ...new Set(d.results.map((o) => o.Banfn.padStart(10, "0"))),
            ];
            this._createSimpleValueHelp(
              oMI,
              "Purchase Requisition",
              "Banfn",
              a
            );
          },
        });
      },

      onValueHelpBsart: function (oEvent) {
        const oMI = oEvent.getSource();
        const oModel = this.getView().getModel();
        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          urlParameters: { $top: 5000 },
          success: (d) => {
            sap.ui.core.BusyIndicator.hide();
            const a = [...new Set(d.results.map((o) => o.Bsart))];
            this._createSimpleValueHelp(oMI, "Document Type", "Bsart", a);
          },
        });
      },

      onValueHelpEkgrp: function (oEvent) {
        const oMI = oEvent.getSource();
        const oModel = this.getView().getModel();
        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          urlParameters: { $top: 5000 },
          success: (d) => {
            sap.ui.core.BusyIndicator.hide();
            const a = [...new Set(d.results.map((o) => o.Ekgrp))];
            this._createSimpleValueHelp(oMI, "Purchasing Group", "Ekgrp", a);
          },
        });
      },

      onValueHelpErnam: function (oEvent) {
        const oMI = oEvent.getSource();
        const oModel = this.getView().getModel();
        sap.ui.core.BusyIndicator.show(0);

        oModel.read("/PRSet", {
          urlParameters: { $top: 5000 },
          success: (d) => {
            sap.ui.core.BusyIndicator.hide();
            const a = [...new Set(d.results.map((o) => o.Ernam))];
            this._createSimpleValueHelp(oMI, "Created By", "Ernam", a);
          },
        });
      },

      // =========================================================
      // NAVIGATION
      // =========================================================
      onNavHome: function () {
    const oRouter = this.getOwnerComponent().getRouter();

    // Reset UI
    this._resetDetailPanel();
    const oTable = this.byId("tblPRList");
    if (oTable) {
        oTable.removeSelections(true);
    }

    // Điều hướng về Dashboard
    oRouter.navTo("DashboardPR", {}, true); // replace history
},


      // Khi manager ấn nút Edit
      onEditNote: function () {
        const oNoteModel = this.getView().getModel("noteModel");
        if (!oNoteModel) return;

        oNoteModel.setProperty("/Editable", true);
        sap.m.MessageToast.show("✏️ Edit mode enabled.");
      },

      // Khi manager ấn Cancel
      onCancelEditNote: function () {
        const oNoteModel = this.getView().getModel("noteModel");
        if (!oNoteModel) return;

        oNoteModel.setProperty("/Editable", false);
        sap.m.MessageToast.show("❌ Edit cancelled.");
      },

      // Khi manager ấn Save
      onSaveNote: function () {
        const oModel = this.getView().getModel();
        const oNoteModel = this.getView().getModel("noteModel");

        const sBanfn = oNoteModel.getProperty("/Banfn");
        const sNote = oNoteModel.getProperty("/Note");

        if (!sBanfn) return sap.m.MessageToast.show("⚠️ No PR selected.");

        const sKeyBanfn = String(sBanfn).padStart(10, "0");
        const oEntry = { Banfn: sKeyBanfn, Note: sNote };

        sap.ui.core.BusyIndicator.show(0);

        // Kiểm tra trước khi update
        oModel.read(`/PRNoteSet(Banfn='${sKeyBanfn}')`, {
          success: (oData) => {
            oModel.update(`/PRNoteSet(Banfn='${sKeyBanfn}')`, oEntry, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageToast.show("✅ Note updated successfully!");
                oNoteModel.setProperty("/Editable", false);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error("❌ Update failed:", err);
                sap.m.MessageToast.show("❌ Failed to update note.");
              },
            });
          },
          error: () => {
            // Nếu chưa có note → tạo mới
            oModel.create("/PRNoteSet", oEntry, {
              success: () => {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageToast.show("✅ Note created successfully!");
                oNoteModel.setProperty("/Editable", false);
              },
              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error("❌ Create failed:", err);
                sap.m.MessageToast.show("❌ Failed to create note.");
              },
            });
          },
        });
      },

      _resetDetailPanel: function () {
    const oDetail = this.byId("detailPanel");
    if (oDetail) {
        oDetail.setVisible(false);
    }

    const oLayout = this.byId("layoutMaster");
    if (oLayout) {
        oLayout.setSize("100%");
    }
   },


      _loadPRNote: function (sBanfn) {
        console.log("📡 Calling OData path:", `/PRNoteSet(Banfn='${sBanfn}')`);

        const oModel = this.getView().getModel();
        const oNoteModel =
          this.getView().getModel("noteModel") ||
          new sap.ui.model.json.JSONModel({
            Banfn: sBanfn,
            Note: "",
            Editable: false,
          });
        this.getView().setModel(oNoteModel, "noteModel");

        const sKeyBanfn = String(sBanfn || "")
          .trim()
          .padStart(10, "0");

        oNoteModel.setProperty("/Note", "Loading...");
        oNoteModel.setProperty("/Editable", false);
        sap.ui.core.BusyIndicator.show(0);

        oModel.read(`/PRNoteSet(Banfn='${sKeyBanfn}')`, {
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();
            console.log("📦 Note data loaded:", oData);
            if (oData && oData.Note && oData.Note.trim() !== "") {
              oNoteModel.setProperty("/Note", oData.Note);
            } else {
              oNoteModel.setProperty("/Note", "— No note available —");
            }
            oNoteModel.setProperty("/Editable", false);
          },
          error: (err) => {
            sap.ui.core.BusyIndicator.hide();
            console.warn("⚠️ Cannot load PR note:", err);
            oNoteModel.setProperty("/Note", "None");
            oNoteModel.setProperty("/Editable", false);
          },
        });
      },

      onGoToDashboard: function () {
    sap.ui.core.UIComponent.getRouterFor(this).navTo("DashboardPR");
      },
 

      onGoToRFQList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("RFQList");
      },
      onGoToPOList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("POList");
      },
    });
  }
);
