sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("demodashboard.controller.RFQItemDetail", {
      formatter: {
        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        netPriceX100: function (v) {
          const n = Number(v);
          if (isNaN(n)) return "";
          return (n * 100).toLocaleString("en-US");
        },

         formatItemIntro: function (sEbelp) {
            if (!sEbelp) return "";
            return "Item " + parseInt(sEbelp, 10);
          }

      },

      onInit: function () {
    this.getOwnerComponent()
        .getRouter()
        .getRoute("RFQItemDetail")
        .attachPatternMatched(this._onObjectMatched, this);
},

_onObjectMatched: function (oEvent) {
    const sEbeln = oEvent.getParameter("arguments").Ebeln;
    const sEbelp = oEvent.getParameter("arguments").Ebelp;

    const oModel = this.getOwnerComponent().getModel();

    // 🔥 ĐƯỜNG DẪN ĐÚNG CHUẨN
    const sPath = `/ProcurementItemSet(Ebeln='${sEbeln}',Ebelp='${sEbelp}')`;

    oModel.read(sPath, {
        success: (oData) => {
            const oItemModel = new sap.ui.model.json.JSONModel(oData);
            this.getView().setModel(oItemModel, "item");
        },
        error: (err) => {
            console.error("❌ Load item error", err);
            sap.m.MessageToast.show("Cannot load item detail");
        }
    });
},


onNavBack: function () {
    this.getOwnerComponent().getRouter().navTo("RFQDetail", {
        Ebeln: this.getView().getModel("item").getProperty("/Ebeln")
    });
}

    });
  }
);
