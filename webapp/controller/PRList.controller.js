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
  ],
  function (
    Controller,
    ODataModel,
    MessageToast,
    MessageBox,
    Spreadsheet,
    JSONModel,
    Filter,
    FilterOperator
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.PRList", {
      // =========================================================
      // FORMATTERS
      // =========================================================
      formatter: {
        statusText: function (s) {
          switch (s) {
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

        statusState: function (s) {
          switch (s) {
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
      },

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
        this.onGoFilter();
        this._loadCaches();
      },

      // =========================================================
      // FILTER + GROUP
      // =========================================================
      onGoFilter: function () {
        const oView = this.getView();
        const oModel = oView.getModel();
        const oTable = oView.byId("tblPRList");

        // Reset selectedKey nếu input rỗng
        ["inpBanfn", "inpBsart", "inpEkgrp", "inpErnam"].forEach(function (id) {
          const oInp = oView.byId(id);
          if (oInp && !oInp.getValue().trim()) {
            oInp.data("selectedKey", "");
          }
        });

        // Hàm lấy key ưu tiên
        const getKey = function (id) {
          const oInp = oView.byId(id);
          const key =
            oInp && oInp.data("selectedKey")
              ? oInp.data("selectedKey").trim()
              : "";
          return key && key !== "" ? key : oInp ? oInp.getValue().trim() : "";
        };

        const sBanfn = getKey("inpBanfn");
        let sBsart = getKey("inpBsart");
        const sEkgrp = getKey("inpEkgrp");
        const sErnam = getKey("inpErnam");

        // Lọc code Bsart trong ngoặc
        if (sBsart && sBsart.includes("(")) {
          const match = sBsart.match(/\(([^)]+)\)$/);
          if (match && match[1]) {
            sBsart = match[1];
          }
        }

        const oDateRange = oView.byId("inpDateRange");
        const dFrom = oDateRange ? oDateRange.getDateValue() : null;
        const dTo = oDateRange ? oDateRange.getSecondDateValue() : null;

        // Tạo filters
        const aFilters = [];
        if (sBanfn) {
          aFilters.push(new Filter("Banfn", FilterOperator.Contains, sBanfn));
        }
        if (sBsart) {
          aFilters.push(new Filter("Bsart", FilterOperator.EQ, sBsart));
        }
        if (sEkgrp) {
          aFilters.push(new Filter("Ekgrp", FilterOperator.Contains, sEkgrp));
        }
        if (sErnam) {
          aFilters.push(
            new Filter("Ernam", FilterOperator.EQ, sErnam.toUpperCase())
          );
        }
        if (dFrom && dTo) {
          aFilters.push(new Filter("Badat", FilterOperator.BT, dFrom, dTo));
        } else if (dFrom) {
          aFilters.push(new Filter("Badat", FilterOperator.GE, dFrom));
        } else if (dTo) {
          aFilters.push(new Filter("Badat", FilterOperator.LE, dTo));
        }

        const bNoFilter =
          !sBanfn && !sBsart && !sEkgrp && !sErnam && !dFrom && !dTo;

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          filters: bNoFilter ? [] : aFilters,
          urlParameters: { $top: 10000, $orderby: "Banfn asc" },
          success: function (data) {
            sap.ui.core.BusyIndicator.hide();
            const all = data.results || [];
            const groups = [];

            all.forEach(function (row) {
              let g = groups.find(function (gg) {
                return gg.Banfn === row.Banfn;
              });
              if (!g) {
                g = {
                  Banfn: row.Banfn,
                  Bsart: row.Bsart,
                  Ekgrp: row.Ekgrp,
                  Ernam: row.Ernam,
                  Badat: row.Badat,
                  Frgkz: row.Frgkz,
                  Items: [row],
                };
                groups.push(g);
              } else {
                g.Items.push(row);
              }
            });

            groups.forEach(function (g) {
              g.ItemCount = g.Items.length;
            });

            oTable.setModel(new JSONModel({ groups: groups }));
            MessageToast.show(
              bNoFilter
                ? "📋 Loaded all " +
                    groups.length +
                    " PRs (" +
                    all.length +
                    " records)."
                : "✅ Loaded " +
                    groups.length +
                    " filtered PRs (" +
                    all.length +
                    " records)."
            );
          },
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Error loading data from server.");
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
        const oCtx = oItem.getBindingContext();
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        const oModel = this.getView().getModel();

        if (!oCtx) return;

        const group = oCtx.getObject();
        const sBanfn = group.Banfn;

        // Pad functions
        const pad5 = function (v) {
          return String(v || "")
            .trim()
            .padStart(5, "0");
        };

        const aLeftItems = Array.isArray(group.Items) ? group.Items : [];

        const hasMatnrOrTxz = aLeftItems.some(function (it) {
          return it.Matnr || it.Txz01;
        });

        const leftKey = function (it) {
          const k1 = pad5(it.Bnfpo);
          const k2 = (it.Matnr || it.Txz01 || "").trim();
          return hasMatnrOrTxz ? k1 + "|" + k2 : k1;
        };

        const leftKeySet = new Set(aLeftItems.map(leftKey));

        // Tạo detail model
        const oDetailModel = new JSONModel({
          Banfn: group.Banfn,
          Bsart: group.Bsart,
          Ekgrp: group.Ekgrp,
          Ernam: group.Ernam,
          Badat: group.Badat,
          Frgkz: group.Frgkz,
          Items: [],
        });

        // Đọc EBAN
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/ebanSet", {
          filters: [new Filter("Banfn", FilterOperator.EQ, sBanfn)],
          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            const aEban = oData && oData.results ? oData.results : [];

            const ebanKey = function (it) {
              const k1 = pad5(it.Bnfpo);
              const k2 = (it.Matnr || it.Txz01 || "").trim();
              return hasMatnrOrTxz ? k1 + "|" + k2 : k1;
            };

            // Intersect
            let aIntersect = aEban.filter(function (it) {
              return leftKeySet.has(ebanKey(it));
            });

            // Fallback nếu không match được
            if (aIntersect.length === 0) {
              const leftBnfpoSet = new Set(
                aLeftItems.map(function (it) {
                  return pad5(it.Bnfpo);
                })
              );
              aIntersect = aEban.filter(function (it) {
                return leftBnfpoSet.has(pad5(it.Bnfpo));
              });
            }

            // Sort
            aIntersect.sort(function (a, b) {
              return pad5(a.Bnfpo).localeCompare(pad5(b.Bnfpo));
            });

            oDetailModel.setProperty("/Items", aIntersect);
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            oDetail.setVisible(true);
            oLayout.setSize("65%");

            const oItemTable = this.byId("tblPRItems");
            if (oItemTable) {
              oItemTable.setModel(oDetailModel);
            }
          }.bind(this),
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            oDetailModel.setProperty("/Items", aLeftItems);
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            oDetail.setVisible(true);
            oLayout.setSize("60%");
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

        const aPendingItems = aItems.filter(function (it) {
          return it.Frgkz === "C";
        });
        const aLockedItems = aItems.filter(function (it) {
          return it.Frgkz === "R" || it.Frgkz === "X";
        });

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
                  this._refreshAfterAction(sBanfn);
                  return;
                }

                const item = items[index];
                const sBanfnPadded = String(item.Banfn).padStart(10, "0");
                const sBnfpoPadded = String(item.Bnfpo).padStart(5, "0");
                const sPath =
                  "/PRsSet(Banfn='" +
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
      // REJECT ALL PENDING ITEMS
      // =========================================================
      onRejectPR: function () {
        const oDetail = this.byId("detailPanel");
        const oDetailModel = oDetail.getModel();
        const aItems = oDetailModel ? oDetailModel.getProperty("/Items") : [];
        const sBanfn = oDetailModel ? oDetailModel.getProperty("/Banfn") : "";

        if (!aItems.length) {
          return MessageToast.show("⚠️ No items to reject.");
        }

        const aPendingItems = aItems.filter(function (it) {
          return it.Frgkz === "C";
        });
        const aLockedItems = aItems.filter(function (it) {
          return it.Frgkz === "R" || it.Frgkz === "X";
        });

        if (aPendingItems.length === 0) {
          return MessageToast.show(
            "ℹ️ All items are already approved or rejected."
          );
        }

        MessageBox.confirm(
          "Reject " +
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
                  let sMsg = "Rejected " + iSuccess + " item(s).";
                  if (iFail > 0) {
                    sMsg += " " + iFail + " failed.";
                  }
                  if (aLockedItems.length > 0) {
                    sMsg +=
                      " Skipped " +
                      aLockedItems.length +
                      " already processed item(s).";
                  }
                  MessageBox.warning(sMsg);
                  this._refreshAfterAction(sBanfn);
                  return;
                }

                const item = items[index];
                const sBanfnPadded = String(item.Banfn).padStart(10, "0");
                const sBnfpoPadded = String(item.Bnfpo).padStart(5, "0");
                const sPath =
                  "/PRsSet(Banfn='" +
                  sBanfnPadded +
                  "',Bnfpo='" +
                  sBnfpoPadded +
                  "')";
                const oPayload = {
                  Banfn: sBanfnPadded,
                  Bnfpo: sBnfpoPadded,
                  Frgkz: "X",
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
      // REFRESH AFTER ACTION
      // =========================================================
      _refreshAfterAction: function (sBanfn) {
        const oModel = this.getView().getModel();
        const oDetail = this.byId("detailPanel");

        // Reload list
        setTimeout(
          function () {
            this.onGoFilter();
          }.bind(this),
          500
        );

        // Reload detail panel
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          filters: [new Filter("Banfn", FilterOperator.EQ, sBanfn)],
          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            const aItems = oData && oData.results ? oData.results : [];
            const oDetailModel = oDetail.getModel();
            oDetailModel.setProperty("/Items", aItems);
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            oDetail.invalidate();
            MessageToast.show("🔄 Refreshed PR details.");
            MessageToast.show("✅ PR " + sBanfn + " refreshed successfully");
          },
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("⚠️ Could not refresh EBAN items.");
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
      onValueHelpBanfn: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        const padBanfn = function (sBanfn) {
          return String(sBanfn || "")
            .trim()
            .padStart(10, "0");
        };

        if (!this._oBanfnDialog) {
          this._oBanfnDialog = new sap.m.SelectDialog({
            title: "Select Purchase Requisition",
            search: function (e) {
              const sVal = e.getParameter("value")
                ? e.getParameter("value").trim()
                : "";
              e.getSource()
                .getBinding("items")
                .filter([new Filter("Banfn", FilterOperator.Contains, sVal)]);
            },
            confirm: function (e) {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sBanfn = oItem.getTitle();
                oView.byId("inpBanfn").setValue(sBanfn);
                oView.byId("inpBanfn").data("selectedKey", sBanfn);
              }
            },
            items: {
              path: "/uniqueBanfn",
              template: new sap.m.StandardListItem({
                title: "{Banfn}",
              }),
            },
          });
        }

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 5000, $orderby: "Banfn asc" },
          success: function (data) {
            sap.ui.core.BusyIndicator.hide();

            const unique = [];
            const seen = new Set();
            const results = data.results || [];

            results.forEach(function (row) {
              const padded = padBanfn(row.Banfn);
              if (!seen.has(padded)) {
                seen.add(padded);
                unique.push({ Banfn: padded });
              }
            });

            const oLocalModel = new JSONModel({ uniqueBanfn: unique });
            this._oBanfnDialog.setModel(oLocalModel);
            this._oBanfnDialog.open();
          }.bind(this),
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Cannot load Purchase Requisition list.");
          },
        });
      },

      onValueHelpBsart: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        const docTypeMap = {
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

        if (!this._oBsartDialog) {
          this._oBsartDialog = new sap.m.SelectDialog({
            title: "Select Document Type",
            search: function (e) {
              const sVal = e.getParameter("value")
                ? e.getParameter("value").trim().toUpperCase()
                : "";
              e.getSource()
                .getBinding("items")
                .filter([new Filter("Bsart", FilterOperator.Contains, sVal)]);
            },
            confirm: function (e) {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sBsart = oItem.getTitle();
                const sDesc = oItem.getDescription();
                const display = sDesc + " (" + sBsart + ")";
                oView.byId("inpBsart").setValue(display);
                oView.byId("inpBsart").data("selectedKey", sBsart);
              }
            },
            items: {
              path: "/DocTypes",
              template: new sap.m.StandardListItem({
                title: "{Bsart}",
                description: "{Batxt}",
              }),
            },
          });
        }

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: function (data) {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];
            const results = data.results || [];

            results.forEach(function (row) {
              const code = row.Bsart ? row.Bsart.trim() : "";
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({
                  Bsart: code,
                  Batxt: docTypeMap[code] || "Unknown Type",
                });
              }
            });

            unique.sort(function (a, b) {
              return a.Bsart.localeCompare(b.Bsart);
            });

            const oLocalModel = new JSONModel({ DocTypes: unique });
            this._oBsartDialog.setModel(oLocalModel);
            this._oBsartDialog.open();
          }.bind(this),
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Cannot load Document Type list.");
          },
        });
      },

      onValueHelpEkgrp: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        if (!this._oEkgrpDialog) {
          this._oEkgrpDialog = new sap.m.SelectDialog({
            title: "Select Purchasing Group",
            search: function (e) {
              const sVal = e.getParameter("value")
                ? e.getParameter("value").trim().toUpperCase()
                : "";
              e.getSource()
                .getBinding("items")
                .filter([new Filter("Ekgrp", FilterOperator.Contains, sVal)]);
            },
            confirm: function (e) {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sEkgrp = oItem.getTitle();
                const sDesc = oItem.getDescription();
                oView.byId("inpEkgrp").setValue(sDesc);
                oView.byId("inpEkgrp").data("selectedKey", sEkgrp);
              }
            },
            items: {
              path: "/PurchGroups",
              template: new sap.m.StandardListItem({
                title: "{Ekgrp}",
                description: "{Eknam}",
              }),
            },
          });
        }

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: function (data) {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];
            const results = data.results || [];

            results.forEach(function (row) {
              const code = row.Ekgrp ? row.Ekgrp.trim() : "";
              const name = row.Eknam ? row.Eknam.trim() : "";
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({
                  Ekgrp: code,
                  Eknam: name || code,
                });
              }
            });

            unique.sort(function (a, b) {
              return a.Ekgrp.localeCompare(b.Ekgrp);
            });

            const oLocalModel = new JSONModel({ PurchGroups: unique });
            this._oEkgrpDialog.setModel(oLocalModel);
            this._oEkgrpDialog.open();
          }.bind(this),
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Cannot load Purchasing Group list.");
          },
        });
      },

      onValueHelpErnam: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        if (!this._oErnamDialog) {
          this._oErnamDialog = new sap.m.SelectDialog({
            title: "Select Created By",
            search: function (e) {
              const sVal = e.getParameter("value")
                ? e.getParameter("value").trim().toUpperCase()
                : "";
              e.getSource()
                .getBinding("items")
                .filter([new Filter("Ernam", FilterOperator.Contains, sVal)]);
            },
            confirm: function (e) {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sErnam = oItem.getTitle();
                oView.byId("inpErnam").setValue(sErnam);
                oView.byId("inpErnam").data("selectedKey", sErnam);
              }
            },
            items: {
              path: "/Users",
              template: new sap.m.StandardListItem({
                title: "{Ernam}",
              }),
            },
          });
        }

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: function (data) {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];
            const results = data.results || [];

            results.forEach(function (row) {
              const code = row.Ernam ? row.Ernam.trim() : "";
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({ Ernam: code });
              }
            });

            unique.sort(function (a, b) {
              return a.Ernam.localeCompare(b.Ernam);
            });

            const oLocalModel = new JSONModel({ Users: unique });
            this._oErnamDialog.setModel(oLocalModel);
            this._oErnamDialog.open();
          }.bind(this),
          error: function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Cannot load Created By list.");
          },
        });
      },

      // =========================================================
      // NAVIGATION
      // =========================================================
      onNavHome: function () {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        if (oRouter) {
          oRouter.navTo("DashBoard");
        } else {
          MessageToast.show("🔙 Back to Home");
        }
      },
    });
  }
);
