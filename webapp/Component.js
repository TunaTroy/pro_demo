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

        // ===== ROLE PERMISSION CONFIG =====
        var routePermission = {
          // Inventory Manager
          DashboardPR: [
            "INVENTORY_MANAGER",
            "INVENTORY_STAFF",
            "PROCUREMENT_STAFF",
            "PROCUREMENT_MANAGER",
            "ADMIN",
          ],

          // PR views
          PRList: [
            "INVENTORY_MANAGER",
            "INVENTORY_STAFF",
            "PROCUREMENT_STAFF", // nhớ xóa quyền
            "ADMIN",
          ],
          PRItemDetail: [
            "INVENTORY_MANAGER",
            "INVENTORY_STAFF",
            "PROCUREMENT_STAFF", // nhớ xóa quyền

            "ADMIN",
          ],

          // RFQ views
          RFQList: ["PROCUREMENT_STAFF", "PROCUREMENT_MANAGER", "ADMIN"],
          RFQItemDetail: ["PROCUREMENT_STAFF", "PROCUREMENT_MANAGER", "ADMIN"],
          RFQDetail: ["PROCUREMENT_STAFF", "PROCUREMENT_MANAGER", "ADMIN"],

          // PO views
          POList: ["PROCUREMENT_STAFF", "PROCUREMENT_MANAGER", "ADMIN"],
          POItemDetail: ["PROCUREMENT_STAFF", "PROCUREMENT_MANAGER", "ADMIN"],
        };

        var oRouter = this.getRouter();
        oRouter.attachBeforeRouteMatched(function (oEvent) {
          var sRoute = oEvent.getParameter("name");
          var oRoleModel = that.getModel("userRole");
          if (!oRoleModel) return;

          var feRole = oRoleModel.getProperty("/feRole"); // e.g., INVENTORY_MANAGER

          if (
            routePermission[sRoute] &&
            routePermission[sRoute].indexOf(feRole) === -1
          ) {
            sap.m.MessageToast.show(
              "Bạn không có quyền truy cập màn hình này!"
            );
            oRouter.navTo("DashboardPR");
          }
        });

        this.setModel(models.createDeviceModel(), "device");

        var oModel = this.getModel("mainService") || this.getModel();
        var that = this;

        // 🔹 1. Gọi API /sap/bc/ui2/start_up để lấy user hiện tại trong SAP Gateway
        $.ajax({
          url: "/sap/bc/ui2/start_up",
          method: "GET",
          success: function (oResponse) {
            var sUserId = oResponse.id || "";
            console.log("🟢 Current SAP User:", sUserId);

            // Bảng role CHUẨN của team
            var userRoleMapping = {
              "LEARN-487": "Z_ROLE_ASSET",
              "LEARN-486": "Z_ROLE_BUILDSQL01",
              "LEARN-488": "Z_ROLE_TMS",
              "LEARN-489": "Z_FIORI_ADMIN",
              "LEARN-490": "Z_ROLE_DEMO1",
            };

            // Các role được phép dùng hệ thống
            var allowedRoles = [
              "Z_ROLE_ASSET",
              "Z_ROLE_BUILDSQL01",
              "Z_ROLE_TMS",
              "Z_FIORI_ADMIN",
              "Z_ROLE_DEMO1",
            ];

            var sRawRole = userRoleMapping[sUserId];

            // ❌ User không có trong danh sách hệ thống → không cho login
            if (!sRawRole || allowedRoles.indexOf(sRawRole) === -1) {
              sap.m.MessageToast.show(
                "❌ Bạn không có quyền truy cập hệ thống!"
              );
              window.location.href = "/logout"; // hoặc redirect ra trang khác
              return;
            }

            var displayRoleMapping = {
              Z_ROLE_ASSET: "Inventory staff", // 487
              Z_ROLE_BUILDSQL01: "Inventory manager", // 486
              Z_ROLE_TMS: "Procurement staff", // 488
              Z_FIORI_ADMIN: "ADMIN", // ADMIN
              Z_ROLE_DEMO1: "Procurement manager", // 490
            };

            // FE Role mapping để dùng trong XML
            var feRoleMapping = {
              Z_ROLE_ASSET: "INVENTORY_STAFF", // 487
              Z_ROLE_BUILDSQL01: "INVENTORY_MANAGER", // 486
              Z_ROLE_TMS: "PROCUREMENT_STAFF", // 488
              Z_FIORI_ADMIN: "ADMIN", // 489
              Z_ROLE_DEMO1: "PROCUREMENT_MANAGER", // 490
            };

            var feRole = feRoleMapping[sRawRole];

            var sRole = displayRoleMapping[sRawRole];

            // Set model
            var oRoleModel = new sap.ui.model.json.JSONModel({
              userid: sUserId,
              role: sRole, // display name "Procurement staff"
              rawRole: sRawRole, // e.g., Z_ROLE_TMS
              feRole: feRole, // e.g., PROCUREMENT_STAFF  <<< QUAN TRỌNG
            });

            that.setModel(oRoleModel, "userRole");

            sap.m.MessageToast.show(
              "Hello " + sUserId + " 😊 - Role: " + sRole
            );
          },
          error: function () {
            sap.m.MessageToast.show("Không thể xác định người dùng!");
          },
        });
      },
    });
  }
);
