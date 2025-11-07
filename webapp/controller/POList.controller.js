sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/core/format/DateFormat",
  "sap/ui/export/Spreadsheet"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, DateFormat, Spreadsheet) {
  "use strict";

  return Controller.extend("demodashboard.controller.POList", {
    formatter: {
      formatDate: function (sDate) {
        if (!sDate) return "";
        try {
          const iTime = parseInt(sDate.replace(/\/Date\((\d+)\)\//, "$1"));
          return DateFormat.getDateInstance({ pattern: "dd.MM.yyyy" }).format(new Date(iTime));
        } catch (e) {
          return "";
        }
      },
      formatReleaseStatusText: function (s) {
        switch (s) {
          case "R": return "Released";
          case "C": return "Pending";
          case "A": return "Blocked";
          default: return "Not Rel.";
        }
      },
      formatReleaseStatusState: function (s) {
        switch (s) {
          case "R": return "Success";
          case "C": return "Warning";
          case "A": return "Error";
          default: return "None";
        }
      },
      formatReleaseStatusIcon: function (s) {
        switch (s) {
          case "R": return "sap-icon://accept";
          case "C": return "sap-icon://pending";
          case "A": return "sap-icon://decline";
          default: return "sap-icon://document";
        }
      }
    },

    onInit: function () {
      this.oODataModel = this.getOwnerComponent().getModel();
      this.oViewModel = new JSONModel({ busy: false });
      this.getView().setModel(this.oViewModel, "view");

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("POList").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this._loadPOList();
    },

    _loadPOList: function () {
      this.oViewModel.setProperty("/busy", true);
      this.oODataModel.read("/ProcurementHeaderSet", {
        filters: [new Filter("Bstyp", FilterOperator.EQ, "F")], // F = PO
        urlParameters: {
          "$expand": "ToItems",
          "$top": 500,
          "$orderby": "Aedat desc"
        },
        success: (oData) => {
          const aPOs = oData.results || [];
          aPOs.forEach(po => {
            po.TotalNetValue = 0;
            po.ItemCount = 0;
            po.GRCount = 0;
            po.IRCount = 0;

            if (po.ToItems && po.ToItems.results) {
              po.ItemCount = po.ToItems.results.length;
              po.ToItems.results.forEach(item => {
                const netwr = parseFloat(item.Netwr) || 0;
                po.TotalNetValue += netwr;

                // Giả lập GR/IR (thực tế cần navigation property riêng)
                if (item.Wepos === true) po.GRCount++;
                if (item.Repos === true) po.IRCount++;
              });
            }
            po.TotalNetValue = po.TotalNetValue.toFixed(2);
            po.VendorName = this._getVendorName(po.Lifnr);
          });

          this.getView().setModel(new JSONModel(aPOs), "po");
          this.oViewModel.setProperty("/busy", false);
        },
        error: (err) => {
          MessageBox.error("Cannot load PO List: " + err.message);
          this.oViewModel.setProperty("/busy", false);
        }
      });
    },

    _getVendorName: function (sLifnr) {
      if (!this._vendorCache) this._vendorCache = {};
      if (this._vendorCache[sLifnr]) return this._vendorCache[sLifnr];

      this.oODataModel.read(`/VendorsSet('${sLifnr}')`, {
        success: (oData) => {
          this._vendorCache[sLifnr] = oData.Name1 || sLifnr;
        },
        async: false
      });
      return this._vendorCache[sLifnr] || sLifnr;
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("DashboardPR");
    },

    onItemPress: function (oEvent) {
      const oPO = oEvent.getSource().getBindingContext("po").getObject();
      MessageToast.show(`PO ${oPO.Ebeln} selected – Detail coming soon!`);
      // this.getOwnerComponent().getRouter().navTo("PODetail", { ebeln: oPO.Ebeln });
    },

    onSearch: function (oEvent) {
      const sQuery = oEvent.getParameter("query").toUpperCase();
      const aFilters = sQuery ? [new Filter({
        filters: [
          new Filter("Ebeln", FilterOperator.Contains, sQuery),
          new Filter("Lifnr", FilterOperator.Contains, sQuery),
          new Filter("ToItems/Matnr", FilterOperator.Contains, sQuery)
        ],
        and: false
      })] : [];
      this.byId("poTable").getBinding("items").filter(aFilters);
    },

    onFilterSearch: function () {
      const aFilters = [];
      const aEbeln = this.byId("poFilter").getTokens().map(t => t.getKey());
      if (aEbeln.length) aFilters.push(new Filter("Ebeln", FilterOperator.In, aEbeln));

      const aVendor = this.byId("vendorFilter").getTokens().map(t => t.getKey());
      if (aVendor.length) aFilters.push(new Filter("Lifnr", FilterOperator.In, aVendor));

      const oDate = this.byId("dateFilter").getDateValue();
      const oDate2 = this.byId("dateFilter").getSecondDateValue();
      if (oDate && oDate2) aFilters.push(new Filter("Aedat", FilterOperator.BT, oDate, oDate2));

      const sStatus = this.byId("statusFilter").getSelectedKey();
      if (sStatus) aFilters.push(new Filter("Frgke", FilterOperator.EQ, sStatus));

      const sEkgrp = this.byId("ekgrpFilter").getValue();
      if (sEkgrp) aFilters.push(new Filter("Ekgrp", FilterOperator.EQ, sEkgrp));

      this.byId("poTable").getBinding("items").filter(aFilters.length ? new Filter(aFilters, true) : []);
    },

    onValueHelpPO: function () { MessageToast.show("Value Help PO – coming soon!"); },
    onValueHelpVendor: function () { MessageToast.show("Value Help Vendor – coming soon!"); },

    onExportExcel: function () {
      const aCols = [
        { label: "PO No.", property: "Ebeln" },
        { label: "Created On", property: "Aedat", type: "Date" },
        { label: "Status", property: "Frgke" },
        { label: "Vendor", property: "Lifnr" },
        { label: "Vendor Name", property: "VendorName" },
        { label: "Total Net", property: "TotalNetValue", type: "Number" },
        { label: "Items", property: "ItemCount", type: "Number" }
      ];
      new Spreadsheet({
        workbook: { columns: aCols },
        dataSource: this.getView().getModel("po").getData(),
        fileName: "PO_List_" + DateFormat.getDateInstance({pattern: "yyyyMMdd"}).format(new Date()) + ".xlsx"
      }).build();
    },

    onPrint: function () {
      MessageToast.show("Print PO – mở SAP GUI hoặc Adobe Form!");
    },

    onOpenNotes: function () {
      MessageToast.show("PO Notes panel – giống PR List, coming soon!");
    },

    onFollowUp: function () {
      MessageToast.show("Follow-up actions: GR, IR, Payment Status...");
    },

    onCreatePO: function () {
      MessageToast.show("Create PO from PR/RFQ – ME21N style coming soon!");
    }
  });
});