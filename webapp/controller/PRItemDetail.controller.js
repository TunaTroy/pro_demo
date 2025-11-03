sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/core/routing/History"
], function (Controller, MessageToast, History) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRItemDetail", {
    onInit: function () {
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.getRoute("PRItemDetail").attachPatternMatched(this._onObjectMatched, this);
    },

    _onObjectMatched: function (oEvent) {
      const sBanfn = oEvent.getParameter("arguments").Banfn;
      const sBnfpo = oEvent.getParameter("arguments").Bnfpo;

      if (!sBanfn || !sBnfpo) {
        MessageToast.show("Missing PR key params!");
        return;
      }

      const oModel = this.getOwnerComponent().getModel(); // 🔹 dùng model trong manifest
      this.getView().setModel(oModel);

      const sPath = `/PRsSet(Banfn='${sBanfn}',Bnfpo='${sBnfpo}')`;
      console.log(" Binding path:", sPath);

      this.getView().bindElement({
        path: sPath,
        events: {
          dataRequested: () => sap.ui.core.BusyIndicator.show(0),
          dataReceived: (oEvt) => {
            sap.ui.core.BusyIndicator.hide();
            const oData = oEvt.getParameter("data");
            if (!oData) {
              MessageToast.show("No data found for this item.");
            } else {
              console.log("✅ Data bound:", oData);
            }
          }
        }
      });
    },

    onNavBack: function () {
      const oHistory = History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("PRList", {}, true);
      }
    }
  });
});
