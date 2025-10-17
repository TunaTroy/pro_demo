sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function(Controller, JSONModel) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRList", {
    onInit: function () {
      // Mock dữ liệu PR
      var oData = {
        PRList: [
          { PRId: "PR001", PRName: "Purchase Request A" },
          { PRId: "PR002", PRName: "Purchase Request B" },
          { PRId: "PR003", PRName: "Purchase Request C" }
        ]
      };
      var oModel = new JSONModel(oData);
      this.getView().setModel(oModel);
    },

    onPRPress: function(oEvent) {
      var sPRId = oEvent.getSource().getBindingContext().getProperty("PRId");
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("PRDetail", { PRId: sPRId });
    }
  });
});
