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
    // 1️⃣ Gọi init gốc
    UIComponent.prototype.init.apply(this, arguments);

    // 2️⃣ Kích hoạt routing
    this.getRouter().initialize();

    // 3️⃣ Tạo model thiết bị
    this.setModel(models.createDeviceModel(), "device");

    // 4️⃣ Đảm bảo model chính (OData) tồn tại
    var oModel = this.getModel("mainService") || this.getModel();
    if (!oModel) {
        console.error("❌ Không tìm thấy OData model 'mainService'");
        return;
    }

    // 5️⃣ Gọi LoginSet lấy role
    var sUserId = "LEARN-488"; // CEO user
    var that = this;

    console.log("🔄 Đang gọi LoginSet cho user:", sUserId);

    oModel.read("/LoginSet('" + sUserId + "')", {
        success: function (oData) {
            console.log("✅ Role user:", oData.Role);

            // Lưu vào model để sử dụng toàn app
            var oRoleModel = new sap.ui.model.json.JSONModel({
                role: oData.Role,
                userid: oData.Userid
            });
            that.setModel(oRoleModel, "userRole");

            sap.m.MessageToast.show("Xin chào " + oData.Userid + " (" + oData.Role + ")");
        },
        error: function (oError) {
            console.error("❌ Không thể lấy role người dùng:", oError);
            sap.m.MessageToast.show("Không thể lấy thông tin role người dùng!");
        }
    });
},

    });
  }
);
