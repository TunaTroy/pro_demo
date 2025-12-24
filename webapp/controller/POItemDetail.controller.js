sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
  ],
  function (Controller, MessageToast, History) {
    "use strict";

    return Controller.extend("demodashboard.controller.POItemDetail", {
      formatter: {
        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        displayEbelp: function (sEbelp) {
          if (!sEbelp) return "";
          return parseInt(sEbelp, 10).toString();
        },

        currencyMultiply100: function (v, waers) {
          const n = Number(v);
          if (isNaN(n)) return "";

          const realValue = n * 100;

          return realValue.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }) + (waers ? ` ${waers}` : "");
        }

      },

      onInit: function () {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter
          .getRoute("POItemDetail")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      _onObjectMatched: function (oEvent) {
        const sEbeln = oEvent.getParameter("arguments").Ebeln;
        const sEbelp = oEvent.getParameter("arguments").Ebelp;

        const oModel = this.getOwnerComponent().getModel();
        this.getView().setModel(oModel);

        const sPath = `/ProcurementItemSet(Ebeln='${sEbeln}',Ebelp='${sEbelp}')`;
        console.log(" Binding path:", sPath); 
        this.getView().bindElement({
          path: sPath,

          events: {
            dataRequested: () => sap.ui.core.BusyIndicator.show(0),
            dataReceived: (oEvt) => {
              sap.ui.core.BusyIndicator.hide();
              console.log("✅ Data loaded:", oEvt.getParameter("data"));
            },
          },
        });
      },

      onNavBack: function () {
        const oHistory = History.getInstance();
        const sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("POList", {}, true);
        }
      },
    });
  }
);
