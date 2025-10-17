sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        /**
         * Tạo model cho pie chart data (thêm data JSON của bạn ở đây).
         * @returns {sap.ui.model.json.JSONModel} The chart model.
         */
        createChartModel: function () {
            // Data JSON bạn cung cấp (thêm vào đây)
            var oChartData = {
                items: [
                    { Category: "A", Value: 10 },
                    { Category: "B", Value: 20 },
                    { Category: "C", Value: 30 }
                ]
            };

            var oModel = new JSONModel(oChartData);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };
});