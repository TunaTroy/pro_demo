sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("demodashboard.controller.RFQDetail", {
      formatter: {
        formatDate: function (value) {
          if (!value) return "";
          try {
            const date = new Date(value);
            return date.toLocaleDateString("en-GB");
          } catch (e) {
            return value;
          }
        },
      },

      onInit: function () {
        this.getOwnerComponent()
          .getRouter()
          .getRoute("RFQDetail")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      _onObjectMatched: function (oEvent) {
        const sEbeln = oEvent.getParameter("arguments").Ebeln;

        this.getView().setModel(new JSONModel({}), "rfq");

        this._loadHeader(sEbeln);
        this._loadItems(sEbeln);
        this._loadNote(sEbeln);
      },

      _loadHeader: function (sEbeln) {
        this.getOwnerComponent()
          .getModel()
          .read("/ProcurementHeaderSet('" + sEbeln + "')", {
            success: (oData) => {
              this.getView().getModel("rfq").setProperty("/", oData);
            },
          });
      },

      _loadItems: function (sEbeln) {
        // ✅ GỌI QUA NAVIGATION → Backend sẽ nhận được lt_source_keys với Ebeln
        this.getOwnerComponent()
          .getModel()
          .read("/ProcurementHeaderSet('" + sEbeln + "')/NP_RFQDetails", {
            success: (oData) => {
              console.log("✅ Items loaded via navigation:", oData.results);
              this.getView()
                .getModel("rfq")
                .setProperty("/Items", oData.results);
            },
            error: (oError) => {
              console.error("❌ Error loading items:", oError);
              this.getView().getModel("rfq").setProperty("/Items", []);
            },
          });
      },

      _loadNote: function (sEbeln) {
        this.getOwnerComponent()
          .getModel()
          .read("/PONoteSet('" + sEbeln + "')", {
            success: (oData) => {
              this.getView().getModel("rfq").setProperty("/Note", oData.Note);
            },
            error: () => {
              this.getView()
                .getModel("rfq")
                .setProperty("/Note", "No note available.");
            },
          });
      },
    });
  }
);
