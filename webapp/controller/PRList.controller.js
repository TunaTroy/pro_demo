sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/m/MessageToast",
  "sap/ui/export/Spreadsheet",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/ResponsivePopover",
  "sap/m/List",
  "sap/m/StandardListItem"
], function (Controller, ODataModel, MessageToast, Spreadsheet, JSONModel, Filter, FilterOperator, ResponsivePopover, List, StandardListItem) {
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
      },
      statusBarStatePending: function (percent) {
        if (percent >= 80) return "Error";
        if (percent >= 40) return "Warning";
        return "Success";
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
          UB: "Stock Transfer"
        };
        const desc = map[sBsart] || "Unknown Type";
        return `${desc} (${sBsart})`;
      }
    },

    onInit: function () {
      const sServiceUrl = "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/";
      const oModel = new ODataModel(sServiceUrl, { useBatch: false, json: true });
      this.getView().setModel(oModel);
      this.byId("detailPanel").setVisible(false);
      this.onGoFilter();
    },

    // =========================================================
    // FILTER + SORT + GROUP
    // =========================================================
    onGoFilter: function () {
      const oView = this.getView();
      const oModel = oView.getModel();
      const oTable = oView.byId("tblPRList");

      const sBanfn = oView.byId("inpBanfn").getValue().trim();
      const sBsart = oView.byId("inpBsart").getValue().trim();
      const sEkgrp = oView.byId("inpEkgrp").getValue().trim();
      const sWerks = oView.byId("inpWerks") ? oView.byId("inpWerks").getValue().trim() : "";
      const sErnam = oView.byId("inpErnam").getValue().trim();
      const sStatus = oView.byId("selStatus") ? oView.byId("selStatus").getSelectedKey() : "";

      const aFilters = [];
      if (sBanfn) aFilters.push(new Filter("Banfn", FilterOperator.Contains, sBanfn));
      if (sBsart) aFilters.push(new Filter("Bsart", FilterOperator.Contains, sBsart));
      if (sEkgrp) aFilters.push(new Filter("Ekgrp", FilterOperator.Contains, sEkgrp));
      if (sWerks) aFilters.push(new Filter("Werks", FilterOperator.Contains, sWerks));
      if (sErnam) aFilters.push(new Filter("Ernam", FilterOperator.Contains, sErnam));
      if (sStatus) aFilters.push(new Filter("Frgkz", FilterOperator.EQ, sStatus));

      sap.ui.core.BusyIndicator.show(0);

      oModel.read("/PRsSet", {
        filters: aFilters,
        urlParameters: { $top: 10000, $orderby: "Banfn asc" },
        success: (oData) => {
          sap.ui.core.BusyIndicator.hide();
          const all = oData.results || [];

          // Sort ASC
          all.sort((a, b) => Number(a.Banfn) - Number(b.Banfn));

          // Group by Banfn
          const groups = [];
          all.forEach(row => {
            let grp = groups.find(g => g.Banfn === row.Banfn);
            if (!grp) {
              grp = { Banfn: row.Banfn, Bsart: row.Bsart, Ekgrp: row.Ekgrp, Ernam: row.Ernam, Badat: row.Badat, Items: [row] };
              groups.push(grp);
            } else {
              grp.Items.push(row);
            }
          });

          // ✅ Tính Status % theo công thức x = 100 / tổng item, % = R_count * x
          groups.forEach(g => {
            g.ItemCount = g.Items.length;
            const rCount = g.Items.filter(it => it.Frgkz === "R").length;
            const x = g.ItemCount > 0 ? (100 / g.ItemCount) : 0;
            const percent = Math.round(rCount * x);
            g.StatusPercent = percent;
            g.StatusDisplay = percent + "%";
          });

          const oJSON = new JSONModel({ groups });
          oTable.setModel(oJSON);
          MessageToast.show(`✅ Loaded ${groups.length} PRs (${all.length} total records).`);
        },
        error: () => {
          sap.ui.core.BusyIndicator.hide();
          MessageToast.show("❌ Error loading data from server.");
        }
      });
    },

    // =========================================================
    // CLEAR FILTER
    // =========================================================
    onClearFilter: function () {
      const oView = this.getView();
      ["inpBanfn", "inpBsart", "inpEkgrp", "inpWerks", "inpErnam"].forEach(id => {
        if (oView.byId(id)) oView.byId(id).setValue("");
      });
      if (oView.byId("selStatus")) oView.byId("selStatus").setSelectedKey("");
      this.onGoFilter();
      MessageToast.show("🔄 Filters cleared. Showing all Purchase Requisitions.");
    },

    // =========================================================
    // DETAIL PANEL
    // =========================================================
    onSelectPR: function (oEvent) {
      const oCtx = oEvent.getParameter("listItem").getBindingContext();
      const oDetail = this.byId("detailPanel");
      const oLayout = this.byId("layoutMaster");

      if (oCtx) {
        const group = oCtx.getObject();
        const first = (group.Items && group.Items[0]) || group;
        const oDetailModel = new JSONModel(first);
        oDetail.setModel(oDetailModel);
        oDetail.bindElement("/");
        oDetail.setVisible(true);
        oLayout.setSize("65%");
        this.byId("txtPRTitle").setText(group.Banfn);
      }
    },

    onCloseDetail: function () {
      const oDetail = this.byId("detailPanel");
      const oLayout = this.byId("layoutMaster");
      oDetail.setVisible(false);
      oLayout.setSize("100%");
      this.byId("tblPRList").removeSelections();
    },

    // =========================================================
    // POPOVER ITEMS
    // =========================================================
    onShowItems: function (oEvent) {
      const oGroup = oEvent.getSource().getBindingContext().getObject();
      const aItems = oGroup.Items || [];

      if (!this._oPopover) {
        const oList = new List({
          items: {
            path: "/",
            template: new StandardListItem({
              title: "{= 'Item ' + ${Bnfpo}}",
              description: "{= 'DocType: ' + ${Bsart} + ' • Group: ' + ${Ekgrp}}",
              info: "{path:'Badat', formatter:'.formatter.dateFormat'}"
            })
          }
        });
        this._oPopover = new ResponsivePopover({
          title: "Items for this PR",
          contentWidth: "400px",
          contentHeight: "300px",
          content: [oList]
        });
        this.getView().addDependent(this._oPopover);
      }

      this._oPopover.setModel(new JSONModel(aItems));
      this._oPopover.openBy(oEvent.getSource());
    },

    // =========================================================
    // EXPORT
    // =========================================================
    onExportExcel: function () {
      const oTable = this.byId("tblPRList");
      const aData = oTable.getModel()?.getData()?.groups || [];
      if (!aData.length) return MessageToast.show("⚠️ No data to export!");

      const aCols = [
        { label: "Purchase Requisition", property: "Banfn" },
        { label: "Document Type", property: "Bsart" },
        { label: "Purchasing Group", property: "Ekgrp" },
        { label: "Created By", property: "Ernam" },
        { label: "Requisition Date", property: "Badat" }
      ];

      const oSheet = new Spreadsheet({
        workbook: { columns: aCols },
        dataSource: aData,
        fileName: "PR_List_Export.xlsx"
      });
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
