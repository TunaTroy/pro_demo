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
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Spreadsheet,Table, Column ) {
  "use strict";

  return Controller.extend("demodashboard.controller.POList", {

    // ============================
    // FORMATTERhhS
    // ============================
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
      this.oViewModel = new JSONModel({ busy: false });
      this.getView().setModel(this.oViewModel, "view");
      this.getView().setModel(new JSONModel(), "detailPO");


      this._loadPOList();
    },


    _createSimpleValueHelp: function (oEvent, sTitle, sKey, aValues) {

    // Convert values -> [{ key: "..."}]
    const aRows = aValues.map(v => {
        let obj = {};
        obj[sKey] = v;
        return obj;
    });

    const oRowsModel = new sap.ui.model.json.JSONModel({ rows: aRows });

    // ===== TABLE =====
    const oTable = new sap.ui.table.Table({
        visibleRowCount: 12,
        selectionMode: "MultiToggle",
        columns: [
            new sap.ui.table.Column({
                width: "180px",
                label: new sap.m.Label({ text: sTitle }),
                template: new sap.m.Text({ text: `{${sKey}}` })
            })
        ]
    });
    oTable.setModel(oRowsModel);
    oTable.bindRows("/rows");

    // ===== SEARCH FIELD =====
    const oSearch = new sap.m.SearchField({
        width: "100%",
        placeholder: "Search...",
        liveChange: (e) => {
            const q = (e.getParameter("newValue") || "").toUpperCase();

            const filtered = aRows.filter(r =>
                String(r[sKey]).toUpperCase().includes(q)
            );

            oRowsModel.setData({ rows: filtered });
        }
    });

    const oFilterBar = new sap.ui.comp.filterbar.FilterBar({
        advancedMode: false,
        filterGroupItems: [],
        basicSearch: oSearch
    });

    // ===== DIALOG =====
    const oMI = oEvent.getSource();

    const oVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        title: sTitle,
        key: sKey,
        supportMultiselect: true,
        supportRanges: false,
        supportRangesOnly: false,

        ok: () => {
            const aIdx = oTable.getSelectedIndices();
            const aSelected = aIdx.map(i => oTable.getContextByIndex(i).getObject()[sKey]);

            oMI.removeAllTokens();
            aSelected.forEach(v =>
                oMI.addToken(new sap.m.Token({ key: v, text: v }))
            );

            oVH.close();
        },

        cancel: () => oVH.close()
    });

    oVH.setFilterBar(oFilterBar);
    oVH.setTable(oTable);

    oVH.open();
},




onValueHelpPO: function (oEvent) {
    const aData = this.getView().getModel("po").getData() || [];
    this._createSimpleValueHelp(
        oEvent,
        "PO Number",
        "Ebeln",
        aData.map(i => i.Ebeln)
    );
},





onValueHelpOrderType: function (oEvent) {
    const aData = this.getView().getModel("po").getData() || [];
    const aTypes = [...new Set(aData.map(i => i.Bsart))];
    this._createSimpleValueHelp(oEvent, "Order Type", "Bsart", aTypes);
},




onValueHelpEkgrp: function (oEvent) {
    const aData = this.getView().getModel("po").getData() || [];
    const aGroups = [...new Set(aData.map(i => i.Ekgrp))];
    this._createSimpleValueHelp(oEvent, "Purch. Group", "Ekgrp", aGroups);
},



onValueHelpErnam: function (oEvent) {
    const aData = this.getView().getModel("po").getData() || [];
    const aUsers = [...new Set(aData.map(i => i.Ernam))];
    this._createSimpleValueHelp(oEvent, "Created By", "Ernam", aUsers);
},










onCloseDetail: function () {
  this.byId("poDetailPanel").setVisible(false);
  this.byId("poTablePane").getLayoutData().setSize("100%");
},




onFilterSearch: function () {

    const oTable = this.byId("poTable");
    const aFilters = [];

    // ====== ⛔ 1. AUTO TOKEN FOR PO NUMBER ======
    const oPO = this.byId("poFilter");
    const sPOtyped = oPO.getValue().trim();
    if (sPOtyped) {
        oPO.addToken(new sap.m.Token({ key: sPOtyped, text: sPOtyped }));
        oPO.setValue("");
    }

    const aPOTokens = oPO.getTokens();
    if (aPOTokens.length > 0) {
        const aPOFilters = aPOTokens.map(t =>
            new sap.ui.model.Filter("Ebeln", sap.ui.model.FilterOperator.EQ, t.getKey())
        );
        aFilters.push(new sap.ui.model.Filter(aPOFilters, false)); // OR
    }

    // ====== ⛔ 2. AUTO TOKEN FOR ORDER TYPE (Bsart) ======
    const oBsart = this.byId("orderTypeFilter");
    const sBsartTyped = oBsart.getValue().trim();
    if (sBsartTyped) {
        oBsart.addToken(new sap.m.Token({ key: sBsartTyped, text: sBsartTyped }));
        oBsart.setValue("");
    }

    const aBsartTokens = oBsart.getTokens();
    if (aBsartTokens.length > 0) {
        const aBsartFilters = aBsartTokens.map(t =>
            new sap.ui.model.Filter("Bsart", sap.ui.model.FilterOperator.EQ, t.getKey())
        );
        aFilters.push(new sap.ui.model.Filter(aBsartFilters, false));
    }

    // ====== ⛔ 3. AUTO TOKEN FOR PURCH. GROUP (Ekgrp) ======
    const oEkgrp = this.byId("ekgrpFilter");
    const sEkgrpTyped = oEkgrp.getValue().trim();
    if (sEkgrpTyped) {
        oEkgrp.addToken(new sap.m.Token({ key: sEkgrpTyped, text: sEkgrpTyped }));
        oEkgrp.setValue("");
    }

    const aEkgrpTokens = oEkgrp.getTokens();
    if (aEkgrpTokens.length > 0) {
        const aEkgrpFilters = aEkgrpTokens.map(t =>
            new sap.ui.model.Filter("Ekgrp", sap.ui.model.FilterOperator.EQ, t.getKey())
        );
        aFilters.push(new sap.ui.model.Filter(aEkgrpFilters, false));
    }

    // ====== ⛔ 4. AUTO TOKEN FOR CREATED BY (Ernam) ======
    const oErnam = this.byId("humanFilter");
    const sErnamTyped = oErnam.getValue().trim();
    if (sErnamTyped) {
        oErnam.addToken(new sap.m.Token({ key: sErnamTyped, text: sErnamTyped }));
        oErnam.setValue("");
    }

    const aErnamTokens = oErnam.getTokens();
    if (aErnamTokens.length > 0) {
        const aErnamFilters = aErnamTokens.map(t =>
            new sap.ui.model.Filter("Ernam", sap.ui.model.FilterOperator.EQ, t.getKey())
        );
        aFilters.push(new sap.ui.model.Filter(aErnamFilters, false));
    }

    // ====== CREATED DATE ======
    const oDateFrom = this.byId("dateFilter").getDateValue();
    const oDateTo = this.byId("dateFilter").getSecondDateValue();
    if (oDateFrom && oDateTo) {
        aFilters.push(new sap.ui.model.Filter("Aedat", sap.ui.model.FilterOperator.BT, oDateFrom, oDateTo));
    }

    // ====== STATUS ======
    const sStatus = this.byId("statusFilter").getSelectedKey();
    if (sStatus) {
        aFilters.push(new sap.ui.model.Filter("Frgzu", sap.ui.model.FilterOperator.EQ, sStatus));
    }

    // ===== APPLY TO TABLE ======
    oTable.getBinding("items").filter(aFilters);
},


    // ============================
    // LOAD PO HEADER + ITEMS
    // ============================
    _loadPOList: function () {
      sap.ui.core.BusyIndicator.show(0);

      let aHeader = [];
      let aItems = [];

      const pHeader = new Promise((resolve, reject) => {
        this.oODataModel.read("/ProcurementHeaderSet", {
          filters: [new Filter("Bstyp", FilterOperator.EQ, "F")], // Only PO
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

      Promise.all([pHeader, pItems]).then(results => {
        aHeader = results[0];
        aItems = results[1];

        // 🔹 Map items to header by Ebeln
        const mapItems = {};
        aItems.forEach(it => {
          if (!mapItems[it.Ebeln]) mapItems[it.Ebeln] = [];
          mapItems[it.Ebeln].push(it);
        });

        // 🔹 Merge Header + Items
        aHeader.forEach(h => {
          h.Items = mapItems[h.Ebeln] || [];
          h.ItemCount = h.Items.length;

          h.TotalNetValue = h.Items
            .reduce((s, it) => s + (parseFloat(it.Netwr) || 0), 0)
            .toFixed(2);

          // ➕ Ekgrp giữ nguyên (không thay đổi)
          h.PurchGroup = h.Ekgrp || "";  // optional alias
        });

        console.log("=== DEBUG PO HEADER ===");
aHeader.forEach(h => {
    console.log("PO:", h.Ebeln, "Aedat:", h.Aedat, typeof h.Aedat);
});


        this.getView().setModel(new JSONModel(aHeader), "po");
        sap.ui.core.BusyIndicator.hide();
      })
      .catch(err => {
        sap.ui.core.BusyIndicator.hide();
        MessageBox.error("Cannot load PO data.");
      });
    },

    // ============================
    // SEARCH
    // ============================
    onSearch: function (oEvent) {
      const sValue = oEvent.getParameter("query")?.toUpperCase() || "";
      const aFilters = [];

      if (sValue) {
        aFilters.push(new Filter({
          filters: [
            new Filter("Ebeln", FilterOperator.Contains, sValue),
            new Filter("Ernam", FilterOperator.Contains, sValue),
            new Filter("Bsart", FilterOperator.Contains, sValue),
            new Filter("Ekgrp", FilterOperator.Contains, sValue) // ⭐ Search by Purch. Group
          ],
          and: false
        }));
      }

      this.byId("poTable").getBinding("items").filter(aFilters);
    },

    // ============================
    // ROW SELECTED
    // ============================
    onItemPress: function (oEvent) {
      const oData = oEvent.getSource().getBindingContext("po").getObject();
      MessageToast.show(`Selected PO ${oData.Ebeln}`);
    },

    // ============================
    // EXPORT EXCEL
    // ============================
    onExportExcel: function () {
      const aCols = [
        { label: "PO Number", property: "Ebeln" },
        { label: "Order Type", property: "Bsart" },
        { label: "Purch. Group", property: "Ekgrp" },   // ⭐ ADD EKGRP
        { label: "Created By", property: "Ernam" },
        { label: "Items Count", property: "ItemCount", type: "Number" },
        { label: "Total Net", property: "TotalNetValue", type: "Number" }
      ];

      new Spreadsheet({
        workbook: { columns: aCols },
        dataSource: this.getView().getModel("po").getData(),
        fileName: "PO_List.xlsx"
      }).build();
    },

    _createVHD: function (sKey, sTitle, aCols, aItems, fnOnSelect) {
    const oColModel = new sap.ui.model.json.JSONModel({ cols: aCols });
    const oRowsModel = new sap.ui.model.json.JSONModel(aItems);

    const oTable = new sap.ui.table.Table({
        selectionMode: "Single",
        visibleRowCount: 10
    });

    // Add columns
    aCols.forEach(c => {
        oTable.addColumn(new sap.ui.table.Column({
            label: new sap.m.Label({ text: c.label }),
            template: new sap.m.Text({ text: `{${c.template}}` })
        }));
    });
    oTable.setModel(oRowsModel);
    oTable.bindRows("/");

    // 👉 Tạo Search Bar
    const oSearch = new sap.m.SearchField({
        liveChange: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue").toUpperCase();

            const aFiltered = aItems.filter(it =>
                Object.values(it).some(v => String(v).toUpperCase().includes(sQuery))
            );

            oRowsModel.setData(aFiltered);
        }
    });

    const oDialog = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        title: sTitle,
        supportRanges: false,
        supportRangesOnly: false,
        key: sKey,
        ok: function (oEvt) {
            const aTokens = oEvt.getParameter("tokens");
            fnOnSelect(aTokens);
            oDialog.close();
        },
        cancel: function () {
            oDialog.close();
        }
    });

    // Nhét search bar vào header
    oDialog.addContent(oSearch);
    oDialog.setTable(oTable);
    oDialog.open();
},


  });
});
