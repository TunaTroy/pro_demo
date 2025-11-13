/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define(
  ["sap/ui/core/UIComponent", "sap/ui/Device", "demodashboard/model/models"],
  function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("demodashboard.Component", {
      metadata: {
        manifest: "json",
      },

      /**
       * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
       * @public
       * @override
       */
      init: function () {
        UIComponent.prototype.init.apply(this, arguments);
        
        this.getRouter().initialize();
        this.setModel(models.createDeviceModel(), "device");

        var oModel = this.getModel("mainService") || this.getModel();
        var that = this;

        // 🔹 1. Gọi API /sap/bc/ui2/start_up để lấy user hiện tại trong SAP Gateway
        $.ajax({
          url: "/sap/bc/ui2/start_up",
          method: "GET",
          success: function (oResponse) {
            // API này trả về object có field "id" (user hiện tại, ví dụ "LEARN-489")
            var sUserId = oResponse.id || "";
            console.log("🟢 User login hiện tại:", sUserId);

            // 🔹 2. Gọi OData LoginSet để lấy role của user đó
            oModel.read("/LoginSet('" + sUserId + "')", {
              success: function (oData) {
                console.log("✅ Role user:", oData.Role);
                var oRoleModel = new sap.ui.model.json.JSONModel({
                  role: oData.Role,
                  userid: oData.Userid,
                });
                that.setModel(oRoleModel, "userRole");
                sap.m.MessageToast.show(
                  "Ahihi Đồ Ngốc - " + oData.Userid + " nè! (" + oData.Role + ") "
                );
              },
              error: function (oError) {
                console.error("❌ Lỗi lấy Role:", oError);
                sap.m.MessageToast.show(
                  "Không thể lấy thông tin role người dùng!"
                );
              },
            });
          },
          error: function (err) {
            console.error(
              "❌ Không thể lấy user từ /sap/bc/ui2/start_up:",
              err
            );
            sap.m.MessageToast.show("Không thể xác định người dùng hiện tại!");
          },
        });
      },
    });
  }
);
