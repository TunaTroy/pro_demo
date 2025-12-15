sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
  ],
  function (Controller, MessageToast, History) {
    "use strict";

    return Controller.extend("demodashboard.controller.PRItemDetail", {
      // ✅ THÊM FORMATTER OBJECT
      formatter: {


         statusTextt: function (sFrgkz, sReason) {
          // ⭐ Reject logic: C + có ReasonId => Rejected
          if (sFrgkz === "C" && sReason) return "Changeable";

          switch (sFrgkz) {
            case "R":
              return "Release";
            case "C":
              return "Changeable";
            case "X":
              return "Rejectd";
            default:
              return "";
          }
        },

        statusStatee: function (sFrgkz, sReason) {
          // ⭐ C + ReasonId => Error (đỏ)
          if (sFrgkz === "C" && sReason) return "Error";

          switch (sFrgkz) {
            case "R":
              return "Success";
            case "C":
              return "None";
            case "X":
              return "Error";
            default:
              return "None";
          }
        },

        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        quantityFormat: function (value) {
          if (value === undefined || value === null || value === "") return "";
          const num = parseFloat(value);
          if (isNaN(num)) return value;
          return num % 1 === 0 ? num.toString() : num.toFixed(3);
        },
      },

      onInit: function () {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter
          .getRoute("PRItemDetail")
          .attachPatternMatched(this._onObjectMatched, this);
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

        const sPath = `/PRSet(Banfn='${sBanfn}',Bnfpo='${sBnfpo}')`;
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

              // // 🔹 Lấy các control trong view
              // const oHeader = this.getView().byId("objHeader");
              // const oHeaderTitle = this.getView().byId("prTitle");

              // // Không format bằng padStart nữa
              // const sFormattedPR = oData.Banfn;
              // const sFormattedItem = oData.Bnfpo;
              // if (oHeader) {
              //   oHeader.setNumber(sFormattedItem);
              // }

              // if (oHeaderTitle) {
              //   oHeaderTitle.setText(`PR ${sFormattedPR}`);
              // }
            },
          },
        });
      },

     onNavBack: function () {
    // ⭐ Đánh dấu bước Back từ PR Item Detail
    sessionStorage.setItem("PR_BACK_FROM_DETAIL", "1");

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
          0: "Standard",
          1: "Limit",
          2: "Consignment",
          3: "Subcontracting",
          4: "Material unknown",
          5: "Third-party",
          6: "Text",
          7: "Stock transfer",
          8: "Material group",
          9: "Service",
          A: "Enhanced Limit",
          C: "Stock prov. by cust.",
          P: "Return.trans.pack.",
        };

        return mPstypTexts[sPstyp] || sPstyp;
      },

      getReleaseStatus: function (sFrgkz) {
        if (!sFrgkz) return "";

        const mFrgkzTexts = {
          // ✅ TÊN ĐÚNG
          X: "Changeable",
          C: "Changeable", // ✅ SỬA CHÍNH TẢ
          R: "Released", // ✅ BỎ DẤU CHẤM
        };

        return mFrgkzTexts[sFrgkz] || "Other"; // ✅ DÙNG ĐÚNG TÊN
      },

      onMaterialPress: function () {
        MessageToast.show("🔗 Material details not implemented yet");
      },
    });
  }
);
