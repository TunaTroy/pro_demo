sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("demodashboard.controller.RFQDetail", {
      formatter: {
        dateFormat: function (sDate) {
          if (!sDate) return "";
          try {
            let timestamp;

            if (typeof sDate === "string" && sDate.indexOf("/Date(") === 0) {
              timestamp = parseInt(sDate.replace(/[^0-9]/g, ""), 10);
            } else {
              timestamp = Date.parse(sDate);
            }

            if (isNaN(timestamp)) return "";
            const d = new   Date(timestamp);
            const dd = ("0" + d.getDate()).slice(-2);
            const mm = ("0" + (d.getMonth() + 1)).slice(-2);
            const yy = d.getFullYear();
            return `${dd}.${mm}.${yy}`;
          } catch (e) {
            return "";
          }
        },

        /** Status text mapping */
        statusText: function (status) {
          const statusMap = {
            A: "In Preparation",
            R: "Released",
            P: "Pending Approval",
            C: "Completed",
            X: "Cancelled",
            "": "Unknown",
          };
          return statusMap[status] || status;
        },

        /** Status color mapping */
        statusState: function (status) {
          const stateMap = {
            R: "Success",
            A: "Warning",
            P: "Information",
            C: "Success",
            X: "Error",
          };
          return stateMap[status] || "None";
        },

        /** RFQ Type (BSART) mapping — CHUẨN SAP ECC */
        rfqTypeText: function (bsart) {
          const map = {
            AN: "RFQ (AN)",
            CPL: "Stock Inquiry (CPL)",
            RAN: "Stock Inquiry (RAN)",
            RFQ: "Request for Quotation (RFQ)",
            ZRFQ: "Request for Quotation (ZRFQ)",
            AB: "Request for GP Bid (AB)",
            RQ: "Request for Quote (RQ)",
            RE: "External Sourcing Request (RE)",

            "": "Unknown",
          };
          return map[bsart] || bsart;
        },
      },

      onInit: function () {
        this.getOwnerComponent()
          .getRouter()
          .getRoute("RFQDetail")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      onItemDetailPress: function (oEvent) {
    const oItem = oEvent.getParameter("listItem");
    if (!oItem) return;

    // Lấy đúng Binding Context của model "rfq"
    const oCtx = oItem.getBindingContext("rfq");
    if (!oCtx) return;

    const oData = oCtx.getObject(); // <-- đây chứa Matnr, Ebelp, Werks,...

    const oRouter = sap.ui.core.UIComponent.getRouterFor(this);

    oRouter.navTo("RFQItemDetail", {
        Ebeln: oData.Ebeln,
        Ebelp: oData.Ebelp,
    });
},


      onNavBack: function () {
    const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("RFQList", {}, true);
  },




      _onObjectMatched: function (oEvent) {
        const sEbeln = oEvent.getParameter("arguments").Ebeln;

        this.getView().setModel(new JSONModel({}), "rfq");

        this._loadHeader(sEbeln);
        this._loadItems(sEbeln);
        this._loadNote(sEbeln);
      },

      _loadHeader: function (sEbeln) {
        this.getOwnerComponent()
          .getModel()
          .read("/ProcurementHeaderSet('" + sEbeln + "')", {
            success: (oData) => {
              this.getView().getModel("rfq").setProperty("/", oData);
            },
          });
      },

      _loadItems: function (sEbeln) {      
        this.getOwnerComponent()
          .getModel()
          .read("/ProcurementHeaderSet('" + sEbeln + "')/NP_RFQDetails", {
            success: (oData) => {
              const aItems = oData.results || [];

              // Gán Items vào model
              this.getView().getModel("rfq").setProperty("/Items", aItems);

              // Nếu có item → lấy Txz01 từ item đầu tiên
              if (aItems.length > 0) {
                this.getView()
                  .getModel("rfq")
                  .setProperty("/Txz01", aItems[0].Txz01);
              } else {
                this.getView().getModel("rfq").setProperty("/Txz01", "");
              }

              console.log(
                "TXZ01 header:",
                this.getView().getModel("rfq").getProperty("/Txz01")
              );
            },
            error: (oError) => {
              console.error("❌ Error loading items:", oError);
              this.getView().getModel("rfq").setProperty("/Items", []);
              this.getView().getModel("rfq").setProperty("/Txz01", "");
            },
          });
      },

      // _loadNote: function (sEbeln) {
      //   this.getOwnerComponent()
      //     .getModel()
      //     .read("/PONoteSet('" + sEbeln + "')", {
      //       success: (oData) => {
      //         this.getView().getModel("rfq").setProperty("/Note", oData.Note);
      //       },
      //       error: () => {
      //         this.getView()
      //           .getModel("rfq")
      //           .setProperty("/Note", "No note available.");
      //       },
      //     });
      // },
    });
  }
);
