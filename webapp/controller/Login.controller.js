sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("demodashboard.controller.Login", {
    onInit: function () {
      // Tạo session model
      var oSessionModel = new JSONModel({
        username: "",
        role: ""
      });
      sap.ui.getCore().setModel(oSessionModel, "sessionModel");
    },

    onLoginPress: function () {
      var oView = this.getView();
      var sUsername = oView.byId("username").getValue();
      var sPassword = oView.byId("password").getValue();
      var sRole = oView.byId("roleSelect").getSelectedKey(); // "1" or "2"

      // ✅ Danh sách user hợp lệ (tạm hardcoded)
      var aUsers = [
        { username: "LEARN-4881", password: "1", role: "1" },
        { username: "LEARN-4882", password: "2", role: "2" }
      ];

      var bIsValid = aUsers.some(function (user) {
        return user.username === sUsername &&
               user.password === sPassword &&
               user.role === sRole;
      });

      if (!sUsername || !sPassword) {
        MessageToast.show("Vui lòng nhập đầy đủ Username và Password");
        return;
      }

      if (bIsValid) {
        // Gán vào session
        var oSessionModel = sap.ui.getCore().getModel("sessionModel");
        oSessionModel.setProperty("/username", sUsername);
        oSessionModel.setProperty("/role", sRole);

        // Điều hướng
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Dashboard");
      } else {
        MessageToast.show("Thông tin đăng nhập không hợp lệ hoặc sai quyền truy cập.");
      }
    }
  });
});
