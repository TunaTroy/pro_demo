sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function(Controller, JSONModel) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRDetail", {
    onInit: function () {
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.getRoute("PRDetail").attachPatternMatched(this._onObjectMatched, this);
    },

    _onObjectMatched: function (oEvent) {
      var sPRId = oEvent.getParameter("arguments").PRId;

      // Giả lập dữ liệu detail theo PRId
      var oData = {};
      switch (sPRId) {
        case "PR001":
          oData = { PRId: "PR001", PRName: "Purchase Request A", Description: "Chi tiết cho A" };
          break;
        case "PR002":
          oData = { PRId: "PR002", PRName: "Purchase Request B", Description: "Chi tiết cho B" };
          break;
        case "PR003":
          oData = { PRId: "PR003", PRName: "Purchase Request C", Description: "Chi tiết cho C" };
          break;
      }

      var oModel = new JSONModel(oData);
      this.getView().setModel(oModel);
    }
  });
});
