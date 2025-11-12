sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/export/Spreadsheet",
  "sap/ui/table/Table",
  "sap/ui/table/Column"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Spreadsheet, Table, Column) {
  "use strict";

  return Controller.extend("demodashboard.controller.POList", {

    formatter: {
      dateFormat: function (sDate) {
        if (!sDate) return "";
        const oDate = new Date(sDate);
        return oDate.toLocaleDateString("en-GB");
      },

      formatReleaseStatusText: function (s) {
        switch (s) {
          case "R": return "Released";
          case "C": return "Pending";
          case "A": return "Blocked";
          default: return "Not Rel.";
        }
      },

      formatReleaseStatusState: function (s) {
        switch (s) {
          case "R": return "Success";
          case "C": return "Warning";
          case "A": return "Error";
          default: return "None";
        }
      },

      formatReleaseStatusIcon: function (s) {
        switch (s) {
          case "R": return "sap-icon://accept";
          case "C": return "sap-icon://pending";
          case "A": return "sap-icon://decline";
          default: return "sap-icon://document";
        }
      }
    },

    // ============================
    // INIT
    // ============================
    onInit: function () {
      this.oODataModel = this.getOwnerComponent().getModel();
      this.getView().setModel(new JSONModel(), "detailPO");
      this.getView().setModel(new JSONModel(), "po");
      this.getView().setModel(new JSONModel({ busy: false }), "view");

      this._loadPOList();
    },

    // ============================
    // SELECT PO HEADER
    // ============================
    onSelectPO: function (oEvent) {
      const oSelectedItem = oEvent.getParameter("listItem");
      if (!oSelectedItem) {
        this.byId("poDetailPanel").setVisible(false);
        this.byId("poTablePane").getLayoutData().setSize("100%");
        return;
      }

      const oPOData = oSelectedItem.getBindingContext("po").getObject();
      this.getView().getModel("detailPO").setData(oPOData);

      const oPanel = this.byId("poDetailPanel");
      oPanel.setVisible(true);
      this.byId("poTablePane").getLayoutData().setSize("60%");

      // 🔹 Load manager note for this PO
      this._loadPONote(oPOData.Ebeln);
    },

    // ============================
    // ITEM CLICK (to detail screen)
    // ============================
    onItemPress: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oCtx = oItem.getBindingContext("detailPO");
      if (!oCtx) return;

      const oData = oCtx.getObject();
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("POItemDetail", {
        Ebeln: oData.Ebeln,
        Ebelp: oData.Ebelp
      });
    },

    // ============================
    // LOAD PO LIST
    // ============================
    _loadPOList: function () {
      sap.ui.core.BusyIndicator.show(0);
      const pHeader = new Promise((resolve, reject) => {
        this.oODataModel.read("/ProcurementHeaderSet", {
          filters: [new Filter("Bstyp", FilterOperator.EQ, "F")],
          success: d => resolve(d.results),
          error: reject
        });
      });

      const pItems = new Promise((resolve, reject) => {
        this.oODataModel.read("/ProcurementItemSet", {
          success: d => resolve(d.results),
          error: reject
        });
      });

      Promise.all([pHeader, pItems]).then(([aHeader, aItems]) => {
        const mapItems = {};
        aItems.forEach(it => {
          if (!mapItems[it.Ebeln]) mapItems[it.Ebeln] = [];
          mapItems[it.Ebeln].push(it);
        });

        aHeader.forEach(h => {
          h.Items = mapItems[h.Ebeln] || [];
          h.ItemCount = h.Items.length;
          h.TotalNetValue = h.Items.reduce((s, it) => s + (parseFloat(it.Netwr) || 0), 0).toFixed(2);
        });

        this.getView().setModel(new JSONModel(aHeader), "po");
        sap.ui.core.BusyIndicator.hide();
      }).catch(() => {
        sap.ui.core.BusyIndicator.hide();
        MessageBox.error("Cannot load PO data.");
      });
    },

    // ====================================================
    // 📝 MANAGER NOTE (PO)
    // ====================================================
    _loadPONote: function (sEbeln) {
  console.log("📡 Loading note for PO:", sEbeln);

  const oModel = this.getView().getModel();
  const oNoteModel =
    this.getView().getModel("poNoteModel") ||
    new sap.ui.model.json.JSONModel({
      Ebeln: sEbeln,
      Note: "",
      Editable: false,
      CanEdit: true // ✅ Mặc định: ai cũng có thể edit
    });
  this.getView().setModel(oNoteModel, "poNoteModel");

  const sKeyEbeln = String(sEbeln || "").trim().padStart(10, "0");
  oNoteModel.setProperty("/Ebeln", sKeyEbeln);
  oNoteModel.setProperty("/Note", "Loading...");
  oNoteModel.setProperty("/Editable", false);
  oNoteModel.setProperty("/CanEdit", true); // ✅ Luôn true

  sap.ui.core.BusyIndicator.show(0);

  // Không cần lấy user nữa vì ai cũng có quyền
  oModel.read(`/PONoteSet(Ebeln='${sKeyEbeln}')`, {
    success: (oData) => {
      sap.ui.core.BusyIndicator.hide();
      oNoteModel.setProperty("/Note", oData.Note || "— No note available —");
      oNoteModel.setProperty("/CanEdit", true); // ✅ Giữ luôn true
      console.log("✅ PO note loaded, edit enabled for all users");
    },
    error: (err) => {
      sap.ui.core.BusyIndicator.hide();
      oNoteModel.setProperty("/Note", "— No note available —");
      oNoteModel.setProperty("/CanEdit", true); // ✅ Cho phép edit cả khi chưa có note
      console.warn("⚠️ Cannot load PO note:", err);
    },
  });
},




    onEditNotePo: function () {
      const oNoteModel = this.getView().getModel("poNoteModel");
      if (!oNoteModel) return;
      oNoteModel.setProperty("/Editable", true);
      MessageToast.show("✏️ Edit mode enabled for PO note.");
    },

    onCancelEditNotePo: function () {
      const oNoteModel = this.getView().getModel("poNoteModel");
      if (!oNoteModel) return;
      oNoteModel.setProperty("/Editable", false);
      MessageToast.show("❌ Edit cancelled.");
    },

    onSaveNotePo: function () {
      const oModel = this.getView().getModel();
      const oNoteModel = this.getView().getModel("poNoteModel");

      const sEbeln = oNoteModel.getProperty("/Ebeln");
      const sNote = oNoteModel.getProperty("/Note");
      if (!sEbeln) return MessageToast.show("⚠️ No PO selected.");

      const oEntry = { Ebeln: sEbeln, Note: sNote };

      sap.ui.core.BusyIndicator.show(0);

      oModel.read(`/PONoteSet(Ebeln='${sEbeln}')`, {
        success: () => {
          oModel.update(`/PONoteSet(Ebeln='${sEbeln}')`, oEntry, {
            success: () => {
              sap.ui.core.BusyIndicator.hide();
              MessageToast.show("✅ PO note updated successfully!");
              oNoteModel.setProperty("/Editable", false);
            },
            error: (err) => {
              sap.ui.core.BusyIndicator.hide();
              console.error("❌ Update failed:", err);
              MessageToast.show("❌ Failed to update note.");
            }
          });
        },
        error: () => {
          oModel.create("/PONoteSet", oEntry, {
            success: () => {
              sap.ui.core.BusyIndicator.hide();
              MessageToast.show("✅ PO note created successfully!");
              oNoteModel.setProperty("/Editable", false);
            },
            error: (err) => {
              sap.ui.core.BusyIndicator.hide();
              console.error("❌ Create failed:", err);
              MessageToast.show("❌ Failed to create note.");
            }
          });
        }
      });
    }

  });
});
