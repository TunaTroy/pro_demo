sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/m/MessageToast",
  "sap/ui/core/routing/History"
], function (Controller, ODataModel, MessageToast, History) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRDetail", {
    onInit: function () {
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.getRoute("PRItemDetail").attachPatternMatched(this._onObjectMatched, this);
    },

    _onObjectMatched: function (oEvent) {
      const sBanfn = oEvent.getParameter("arguments").Banfn;
      const sBnfpo = oEvent.getParameter("arguments").Bnfpo;

      const oModel = new ODataModel("/sap/opu/odata/sap/ZGW_PRO_G18_SRV/", {
        useBatch: false,
      });

      sap.ui.core.BusyIndicator.show(0);
      oModel.read(`/EbanSet(Banfn='${sBanfn}',Bnfpo='${sBnfpo}')`, {
        success: (oData) => {
          sap.ui.core.BusyIndicator.hide();
          const oJSON = new sap.ui.model.json.JSONModel(oData);
          this.getView().setModel(oJSON);
        },
        error: () => {
          sap.ui.core.BusyIndicator.hide();
          MessageToast.show("❌ Cannot load item detail.");
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
        oRouter.navTo("PRList", {}, true);
      }
    },
  });
});
