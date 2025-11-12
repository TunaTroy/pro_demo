sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/core/routing/History"
], function (Controller, MessageToast, History) {
  "use strict";

  return Controller.extend("demodashboard.controller.POItemDetail", {
    onInit: function () {
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.getRoute("POItemDetail").attachPatternMatched(this._onObjectMatched, this);
    },

    _onObjectMatched: function (oEvent) {
      const sEbeln = oEvent.getParameter("arguments").Ebeln;
      const sEbelp = oEvent.getParameter("arguments").Ebelp;

      if (!sEbeln || !sEbelp) {
        MessageToast.show("Missing PO key parameters!");
        return;
      }

      const oModel = this.getOwnerComponent().getModel();
      this.getView().setModel(oModel);

      // 🔹 Đường dẫn đến entity OData
      const sPath = `/ProcurementItemSet(Ebeln='${sEbeln}',Ebelp='${sEbelp}')`;
      console.log("🔗 Binding path:", sPath);

      this.getView().bindElement({
        path: sPath,
        model: "item",
        events: {
          dataRequested: () => sap.ui.core.BusyIndicator.show(0),
          dataReceived: (oEvt) => {
            sap.ui.core.BusyIndicator.hide();
            const oData = oEvt.getParameter("data");

            if (!oData) {
              MessageToast.show("No data found for this PO item.");
              return;
            }

            console.log("✅ Data bound:", oData);

            // 🧩 Cập nhật tiêu đề hoặc header nếu có
            const oHeaderTitle = this.getView().byId("txtHeaderTitle");
            const oHeaderItem = this.getView().byId("objItemNumber");

            if (oHeaderTitle) {
              oHeaderTitle.setText(`PO ${oData.Ebeln}`);
            }

            if (oHeaderItem) {
              oHeaderItem.setNumber(oData.Ebelp);
            }
          },
          dataStateChange: (oEvt) => {
            if (oEvt.getParameter("error")) {
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageBox.error("Error loading PO item data.");
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
        oRouter.navTo("POList", {}, true);
      }
    }
  });
});
