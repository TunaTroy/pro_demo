sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/core/routing/History"
], function (Controller, MessageToast, History) {
  "use strict";

  return Controller.extend("demodashboard.controller.PRItemDetail", {
    onInit: function () {
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.getRoute("PRItemDetail").attachPatternMatched(this._onObjectMatched, this);
    },

    _onObjectMatched: function (oEvent) {
      const sBanfn = oEvent.getParameter("arguments").Banfn;
      const sBnfpo = oEvent.getParameter("arguments").Bnfpo;

      if (!sBanfn || !sBnfpo) {
        MessageToast.show("Missing PR key params!");
        return;
      }

      const oModel = this.getOwnerComponent().getModel();
      this.getView().setModel(oModel);

      const sPath = `/PRsSet(Banfn='${sBanfn}',Bnfpo='${sBnfpo}')`;
      console.log(" Binding path:", sPath);

      this.getView().bindElement({
        path: sPath,
        events: {
          dataRequested: () => sap.ui.core.BusyIndicator.show(0),
          dataReceived: (oEvt) => {
            sap.ui.core.BusyIndicator.hide();
            const oData = oEvt.getParameter("data");
            if (!oData) {
              MessageToast.show("No data found for this item.");
              return;
            }

            console.log("✅ Data bound:", oData);

            // 🔹 Lấy các control trong view
            const oHeader = this.getView().byId("objHeader");
            const oHeaderTitle = this.getView().byId("prTitle");

            // Không format bằng padStart nữa
            const sFormattedPR = oData.Banfn;   
            const sFormattedItem = oData.Bnfpo; 
            if (oHeader) {
              oHeader.setNumber(sFormattedItem);
            }

            if (oHeaderTitle) {
              oHeaderTitle.setText(`PR ${sFormattedPR}`);
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
        oRouter.navTo("PRList", {}, true);
      }
    },


    getItemCategoryText: function (sPstyp) {
      if (!sPstyp) return "";

      const mPstypTexts = {
        "0": "Standard",
        "1": "Limit",
        "2": "Consignment",
        "3": "Subcontracting",
        "4": "Material unknown",
        "5": "Third-party",
        "6": "Text",
        "7": "Stock transfer",
        "8": "Material group",
        "9": "Service",
        "A": "Enhanced Limit",
        "C": "Stock prov. by cust.",
        "P": "Return.trans.pack."
      };

      // Trả về text mô tả, hoặc giá trị gốc nếu không khớp
      return mPstypTexts[sPstyp] || sPstyp;
    },

    getReleaseStatus: function (sFrgkz) {
      if (!sFrgkz) return "";

      const mPstypTexts = {
        "X": "Rejected",
        "C": "Pendding.",
        "R": "Approved."
      };

      // Trả về text mô tả, hoặc giá trị gốc nếu không khớp
      return mFrgkzTexts[sFrgkz] ? mFrgkzTexts[sFrgkz] : "Other";
    },



  });
});
