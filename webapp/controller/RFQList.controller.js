sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment",
  ],
  function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
    MessageToast,
    DateFormat,
    Spreadsheet,
    Fragment
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.RFQList", {
      formatter: {
        formatDate: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(
            parseInt(sDate.replace(/\/Date\((\d+)\)\//, "$1"))
          );
          return DateFormat.getDateInstance({ pattern: "dd.MM.yyyy" }).format(
            oDate
          );
        },
        formatReleaseStatusText: function (sStatus) {
          switch (sStatus) {
            case "R":
              return "Released";
            case "C":
              return "Pending";
            case "A":
              return "Blocked";
            default:
              return "Unknown";
          }
        },
        formatReleaseStatusState: function (sStatus) {
          switch (sStatus) {
            case "R":
              return "Success";
            case "C":
              return "Warning";
            case "A":
              return "Error";
            default:
              return "None";
          }
        },
        formatReleaseStatusIcon: function (sStatus) {
          switch (sStatus) {
            case "R":
              return "sap-icon://accept";
            case "C":
              return "sap-icon://pending";
            case "A":
              return "sap-icon://decline";
            default:
              return "sap-icon://question-mark";
          }
        },
      },

      onInit: function () {
        this.oODataModel = this.getOwnerComponent().getModel();
        this.oViewModel = new JSONModel({ busy: false, delay: 0 });
        this.getView().setModel(this.oViewModel, "view");

        this._loadRFQList();

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("RFQList")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        this._loadRFQList();
      },

      _loadRFQList: function () {
        this.oViewModel.setProperty("/busy", true);

        // ⚠️ Giảm tải: bỏ $expand tạm thời hoặc chỉ dùng khi cần
        this.oODataModel.read("/ProcurementHeaderSet", {
          filters: [
            new sap.ui.model.Filter(
              "Bstyp",
              sap.ui.model.FilterOperator.EQ,
              "A"
            ),
          ],
          urlParameters: {
            $top: 50, // ✅ chỉ lấy 50 dòng để test trước
            $orderby: "Aedat desc",
            // ❌ bỏ "$expand": "to_Items" tạm thời
          },
          success: (oData) => {
            console.log("[RFQ] loaded:", oData.results.length, "rows");
            const aRFQs = oData.results || [];
            this.getView().setModel(
              new sap.ui.model.json.JSONModel({ results: aRFQs }),
              "rfq"
            );
            this.oViewModel.setProperty("/busy", false);
          },
          error: (err) => {
            console.error("[RFQ] read error:", err);
            sap.m.MessageBox.error("Error loading RFQ List");
            this.oViewModel.setProperty("/busy", false);
          },
        });
      },

      _getVendorName: function (sLifnr) {
        if (!this._vendorCache) this._vendorCache = {};
        if (this._vendorCache[sLifnr]) return this._vendorCache[sLifnr];
        this.oODataModel.read(`/VendorsSet('${sLifnr}')`, {
          success: (oData) => {
            this._vendorCache[sLifnr] = oData.Name1 || sLifnr;
          },
          async: false,
        });
        return this._vendorCache[sLifnr] || sLifnr;
      },

      onNavBack: function () {
        this.getOwnerComponent().getRouter().navTo("DashboardPR");
      },

      onItemPress: function (oEvent) {
        const oItem = oEvent.getSource().getBindingContext("rfq").getObject();
        MessageToast.show(`Selected RFQ: ${oItem.Ebeln}`);
      },

      onSearch: function (oEvent) {
        const sQuery = oEvent.getParameter("query");
        const aFilters = [];
        if (sQuery) {
          aFilters.push(
            new Filter({
              filters: [
                new Filter("Ebeln", FilterOperator.Contains, sQuery),
                new Filter("Lifnr", FilterOperator.Contains, sQuery),
              ],
              and: false,
            })
          );
        }
        this.byId("rfqTable").getBinding("items").filter(aFilters);
      },

      onFilterSearch: function () {
        const aFilters = [];

        const aEbeln = this.byId("ebelnFilter")
          .getTokens()
          .map((t) => t.getKey());
        if (aEbeln.length)
          aFilters.push(new Filter("Ebeln", FilterOperator.In, aEbeln));

        const aVendor = this.byId("vendorFilter")
          .getTokens()
          .map((t) => t.getKey());
        if (aVendor.length)
          aFilters.push(new Filter("Lifnr", FilterOperator.In, aVendor));

        const oDate = this.byId("dateFilter").getDateValue();
        const oDate2 = this.byId("dateFilter").getSecondDateValue();
        if (oDate && oDate2)
          aFilters.push(new Filter("Aedat", FilterOperator.BT, oDate, oDate2));

        const sStatus = this.byId("statusFilter").getSelectedKey();
        if (sStatus)
          aFilters.push(new Filter("Frgke", FilterOperator.EQ, sStatus));

        this.byId("rfqTable")
          .getBinding("items")
          .filter(aFilters.length ? new Filter(aFilters, true) : []);
      },

      onExportExcel: function () {
        const aCols = [
          { label: "RFQ No.", property: "Ebeln" },
          { label: "Created On", property: "Aedat", type: "Date" },
          { label: "Status", property: "Frgke" },
          { label: "Vendor", property: "Lifnr" },
          { label: "Total Value", property: "TotalValue", type: "Number" },
        ];
        const oSettings = {
          workbook: { columns: aCols },
          dataSource: this.getView().getModel("rfq").getProperty("/results"),
          fileName:
            "RFQ_List_" + new Date().toISOString().slice(0, 10) + ".xlsx",
        };
        new Spreadsheet(oSettings).build();
      },

      onOpenNotes: function () {
        MessageToast.show("Notes panel - coming soon!");
      },

      onCreateRFQ: function () {
        MessageToast.show("Create New RFQ - coming soon!");
      },
    });
  }
);
