sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/m/MessageToast",
  "sap/ui/export/Spreadsheet",
  "sap/ui/model/json/JSONModel",
  "sap/m/SelectDialog",
  "sap/m/StandardListItem",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, ODataModel, MessageToast, Spreadsheet, JSONModel, SelectDialog, StandardListItem, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRList", {

    formatter: {
      statusText: function (s) {
        switch (s) {
          case "C": return "Approved";
          case "R": return "Pending";
          case "X": return "Rejected";
          default: return s || "";
        }
      },
      statusState: function (s) {
        switch (s) {
          case "C": return "Success";
          case "R": return "Warning";
          case "X": return "Error";
          default: return "None";
        }
      }
    },

    onInit: function () {
      const sServiceUrl = "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/";
      const oModel = new ODataModel(sServiceUrl, { useBatch: false, json: true });
      this.getView().setModel(oModel);

      oModel.metadataLoaded()
        .then(() => {
          console.log("✅ Metadata loaded for PRsSet");
          // Ensure table binding is ready
          const oTable = this.byId("tblPRList");
          if (oTable && !oTable.getBinding("items")) {
            oTable.bindItems({
              path: "/PRsSet",
              template: oTable.getBindingInfo("items")?.template || oTable.getItems()[0]?.clone()
            });
          }
        })
        .catch((err) => {
          console.error("❌ Metadata load failed", err);
          MessageToast.show("Cannot load OData metadata!");
        });

      this.byId("detailPanel").setVisible(false);
    },

    // =========================================================
    // SEARCH HELP - PURCHASE REQUISITION (Banfn)
    // =========================================================
    onValueHelpBanfn: function () {
      const oView = this.getView();
      const oModel = oView.getModel();

      if (!this._oPRDialog) {
        this._oPRDialog = new SelectDialog({
          title: "Select Purchase Requisition",
          search: function (oEvent) {
            const sValue = oEvent.getParameter("value")?.trim() || "";
            const oBinding = oEvent.getSource().getBinding("items");

            if (!sValue) {
              oBinding.filter([]);
              return;
            }

            const aFilters = [
              new Filter("Banfn", FilterOperator.Contains, sValue),
              new Filter("Txz01", FilterOperator.Contains, sValue)
            ];
            oBinding.filter(new Filter(aFilters, false));
          },
          confirm: function (oEvt) {
            const oItem = oEvt.getParameter("selectedItem");
            if (oItem) {
              const sPR = oItem.getDescription();
              oView.byId("inpBanfn").setValue(sPR);
              oView.byId("inpBanfn").data("selectedKey", sPR);
              console.log("✅ Selected PR:", sPR);
            }
          },
          items: {
            path: "/PRsSet",
            template: new StandardListItem({
              title: "{Txz01}",
              description: "{Banfn}"
            })
          }
        });

        this._oPRDialog.setModel(oModel);
      }

      this._oPRDialog.open();
    },

    // =========================================================
    // SEARCH HELP - DOCUMENT TYPE (Bsart)
    // =========================================================
    onValueHelpBsart: function () {
      const oView = this.getView();
      const oModel = oView.getModel();

      if (!this._oDocTypeDialog) {
        this._oDocTypeDialog = new SelectDialog({
          title: "Select Document Type",
          search: function (oEvent) {
            const sValue = oEvent.getParameter("value")?.trim() || "";
            const oBinding = oEvent.getSource().getBinding("items");

            if (!sValue) {
              oBinding.filter([]);
              return;
            }

            const aFilters = [
              new Filter("Bsart", FilterOperator.Contains, sValue)
            ];
            oBinding.filter(new Filter(aFilters, false));
          },
          confirm: function (oEvt) {
            const oItem = oEvt.getParameter("selectedItem");
            if (oItem) {
              const sType = oItem.getTitle();
              oView.byId("inpBsart").setValue(sType);
              oView.byId("inpBsart").data("selectedKey", sType);
              console.log("✅ Selected Doc Type:", sType);
            }
          },
          items: {
            path: "/PRsSet",
            template: new StandardListItem({
              title: "{Bsart}",
              description: "{Ernam}"
            })
          }
        });

        this._oDocTypeDialog.setModel(oModel);
      }

      this._oDocTypeDialog.open();
    },

    // =========================================================
    // GO FILTER - Apply filters to OData binding directly
    // =========================================================
    onGoFilter: function () {
      const sBanfn = this.byId("inpBanfn").getValue().trim();
      const sBsart = this.byId("inpBsart").getValue().trim();
      const oTable = this.byId("tblPRList");
      const oBinding = oTable.getBinding("items");

      // Build filters array
      const aFilters = [];
      if (sBanfn) {
        aFilters.push(new Filter("Banfn", FilterOperator.EQ, sBanfn));
      }
      if (sBsart) {
        aFilters.push(new Filter("Bsart", FilterOperator.EQ, sBsart));
      }

      // Apply filters to binding (combines with AND logic)
      if (oBinding) {
        if (aFilters.length > 0) {
          oBinding.filter(new Filter(aFilters, true)); // true = AND
          MessageToast.show(`🔍 Filtering by: ${sBanfn || ''} ${sBsart || ''}`);
        } else {
          oBinding.filter([]); // Clear filters
          MessageToast.show("🔁 Showing all Purchase Requisitions");
        }
      }
    },

    // =========================================================
    // WHEN SELECT A ROW
    // =========================================================
    onSelectPR: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oCtx = oItem.getBindingContext();

      const oDetail = this.byId("detailPanel");
      const oLayout = this.byId("layoutMaster");

      if (oCtx) {
        oDetail.setVisible(true);
        oLayout.setSize("65%");
        oDetail.setBindingContext(oCtx);
        this.byId("txtPRTitle").setText(oCtx.getProperty("Banfn"));
      }
    },

    onCloseDetail: function () {
      const oDetail = this.byId("detailPanel");
      const oLayout = this.byId("layoutMaster");
      oDetail.setVisible(false);
      oLayout.setSize("100%");
      this.byId("tblPRList").removeSelections();
    },

    onExportExcel: function () {
      const oTable = this.byId("tblPRList");
      const oBinding = oTable.getBinding("items");
      
      if (!oBinding) {
        MessageToast.show("⚠️ No data to export!");
        return;
      }

      // Get contexts from binding (respects filters)
      const aContexts = oBinding.getContexts();
      const aData = aContexts.map(ctx => ctx.getObject());

      if (!aData.length) {
        MessageToast.show("⚠️ No data to export!");
        return;
      }

      const aCols = [
        { label: "Purchase Req.", property: "Banfn" },
        { label: "Item No.", property: "Bnfpo" },
        { label: "Document Type", property: "Bsart" },
        { label: "Purchasing Group", property: "Ekgrp" },
        { label: "Created By", property: "Ernam" },
        { label: "Status", property: "Frgkz" }
      ];

      const oSettings = {
        workbook: { columns: aCols },
        dataSource: aData,
        fileName: "PR_List_Export.xlsx"
      };

      const oSheet = new Spreadsheet(oSettings);
      oSheet.build().then(() => MessageToast.show("✅ Export successful!"))
        .finally(() => oSheet.destroy());
    },

    onNavHome: function () {
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      if (oRouter) oRouter.navTo("DashBoard");
      else MessageToast.show("🔙 Back to Home");
    }
  });
});