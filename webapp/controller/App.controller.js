sap.ui.define(["sap/ui/core/mvc/Controller"], function (BaseController) {
  "use strict";

  return BaseController.extend("demodashboard.controller.App", {
    onInit: function () {
      var oRoleModel = this.getOwnerComponent().getModel("userRole");
      if (oRoleModel) {
        oRoleModel.attachRequestCompleted(function () {
          console.log("Role model loaded:", oRoleModel.getData());
        });
      }
    },
  });
});
