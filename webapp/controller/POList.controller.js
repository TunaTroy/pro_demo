sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
  ],
  function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
    MessageToast,
    Spreadsheet,
    Table,
    Column
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.POList", {
      formatter: {
        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },

        // ===== STATUS TEXT =====
        formatReleaseStatusText: function (sFrgke, bIsRejected) {
          if (sFrgke === "R") {
            return "Released";
          }

          if (sFrgke === "C") {
            return bIsRejected ? "Processing" : "Processing";
          }

          return "Unknown";
        },

        // ===== STATUS STATE =====
        formatReleaseStatusState: function (sFrgke, bIsRejected) {
          if (sFrgke === "R") {
            return "Success"; // green
          }

          if (sFrgke === "C") {
            return bIsRejected ? "Error" : "Warning"; // red / orange
          }

          return "None";
        },

        // ===== STATUS ICON =====
        formatReleaseStatusIcon: function (sFrgke, bIsRejected) {
          if (sFrgke === "R") {
            return "sap-icon://accept";
          }

          if (sFrgke === "C") {
            return bIsRejected ? "sap-icon://decline" : "sap-icon://pending";
          }

          return "sap-icon://document";
        },

        displayEbelp: function (sEbelp) {
          if (!sEbelp) return "";
          return parseInt(sEbelp, 10).toString();
        },
      },

      _aRejectPOReasons: [],

      // ============================
      // INIT
      // ============================
      onInit: function () {
        // 🔥 Model riêng dùng cho PO, không dùng model global từ Component nữa
        this.oODataModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/"
          // {
          //   useBatch: false,
          //   defaultUpdateMethod: sap.ui.model.odata.UpdateMethod.PUT,
          //   json: true,
          // }
        );

        // Gán model cho view để binding UI
        this.getView().setModel(this.oODataModel);

        this.getView().setModel(new JSONModel(), "detailPO");
        this.getView().setModel(new JSONModel(), "po");
        this.getView().setModel(new JSONModel({ busy: false }), "view");

        this._createdDateSortState = 0;

        // ⭐ Khi vào lại route POList -> Reload + reset UI
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter
          .getRoute("POList")
          .attachPatternMatched(this._onRouteMatched, this);

        // Load PO List lần đầu
        this._loadPOList();

        this._loadRejectPOReasons();
      },

      _onRouteMatched: function () {
        console.log("🔄 Route POList matched → reload + reset UI");

        // 1. Reload PO List
        this._loadPOList();

        // 2. Close PO detail panel
        const oDetail = this.byId("poDetailPanel");
        if (oDetail) {
          oDetail.setVisible(false);
        }

        // 3. Reset layout (full width)
        const oPane = this.byId("poTablePane");
        if (oPane) {
          const oLD = oPane.getLayoutData();
          if (oLD) oLD.setSize("100%");
        }

        // 4. Clear table selection
        const oTable = this.byId("poTable");
        if (oTable) {
          oTable.removeSelections(true);
        }

        // 5. Reset detailPO model
        const oDetailPO = this.getView().getModel("detailPO");
        if (oDetailPO) {
          oDetailPO.setData({});
        }

        // 6. Clear PO Note
        const oNoteModel = this.getView().getModel("poNoteModel");
        if (oNoteModel) {
          oNoteModel.setProperty("/Ebeln", "");
          oNoteModel.setProperty("/Note", "");
          oNoteModel.setProperty("/Editable", false);
          oNoteModel.setProperty("/CanEdit", true);
        }
      },

      // ============================
      // SELECT PO HEADER
      // ============================
      onSelectPO: function (oEvent) {
        const oSelectedItem = oEvent.getParameter("listItem");

        if (!oSelectedItem) {
          this.onCloseDetail();
          return;
        }

        const oPOData = oSelectedItem.getBindingContext("po").getObject();
        this.getView().getModel("detailPO").setData(oPOData);

        this.byId("poDetailPanel").bindElement("detailPO>/");
        this.byId("poDetailPanel").setVisible(true);

        // LEFT 60%
        this.byId("poTableLayout").setSize("75%");
        // RIGHT 40%
        this.byId("_IDGenSplitterLayoutData1").setSize("25%");

        const oItemTable = this.byId("tblPOItems");
        if (oItemTable) {
          oItemTable.removeSelections(true);
        }

        this._loadPONote(oPOData.Ebeln);
      },

      onCloseDetail: function () {
        // Ẩn panel bên trong
        this.byId("poDetailPanel").setVisible(false);

        // LEFT FULL WIDTH
        this.byId("poTableLayout").setSize("100%");

        // RIGHT PANE WIDTH = 0% (rất quan trọng)
        this.byId("_IDGenSplitterLayoutData1").setSize("0%");

        // Reset chọn
        const oTable = this.byId("poTable");
        if (oTable) oTable.removeSelections(true);
      },

      // ============================
      // ITEM CLICK (to detail screen)
      // ============================
      onItemPress: function (oEvent) {
        this.byId("poDetailPanel").setVisible(false);
        this.byId("poTablePane").getLayoutData().setSize("100%");

        const oItem = oEvent.getParameter("listItem");
        const oCtx = oItem.getBindingContext("detailPO");
        if (!oCtx) return;

        const oData = oCtx.getObject();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("POItemDetail", {
          Ebeln: oData.Ebeln,
          Ebelp: oData.Ebelp,
        });
      },

      onFilterSearch: function () {
        const aSourceData = this._originalPOData || [];
        let aResult = [...aSourceData];

        // ====== PO NUMBER ======
        const oPO = this.byId("poFilter");
        const sPOtyped = oPO.getValue().trim();
        if (sPOtyped) {
          oPO.addToken(new sap.m.Token({ key: sPOtyped, text: sPOtyped }));
          oPO.setValue("");
        }

        const aPOTokens = oPO.getTokens().map((t) => t.getKey());
        if (aPOTokens.length) {
          aResult = aResult.filter((r) => aPOTokens.includes(r.Ebeln));
        }

        // ====== ORDER TYPE ======
        const aBsart = this.byId("orderTypeFilter")
          .getTokens()
          .map((t) => t.getKey());
        if (aBsart.length) {
          aResult = aResult.filter((r) => aBsart.includes(r.Bsart));
        }

        // ====== PURCH GROUP ======
        const aEkgrp = this.byId("ekgrpFilterd")
          .getTokens()
          .map((t) => t.getKey());
        if (aEkgrp.length) {
          aResult = aResult.filter((r) => aEkgrp.includes(r.Ekgrp));
        }

        // ====== CREATED BY ======
        const aErnam = this.byId("humanFilter")
          .getTokens()
          .map((t) => t.getKey());
        if (aErnam.length) {
          aResult = aResult.filter((r) => aErnam.includes(r.Ernam));
        }

        // ====== CREATED DATE ======
        const oDateFrom = this.byId("dateFilter").getDateValue();
        const oDateTo = this.byId("dateFilter").getSecondDateValue();
        if (oDateFrom && oDateTo) {
          aResult = aResult.filter((r) => {
            const d = new Date(r.Aedat);
            return d >= oDateFrom && d <= oDateTo;
          });
        }

        // ====== STATUS (⭐ NGHIỆP VỤ CHUẨN) ======
        const sStatus = this.byId("statusFilter").getSelectedKey();
        if (sStatus && sStatus !== "ALL") {
          aResult = aResult.filter((r) => {
            switch (sStatus) {
              case "Released":
                return r.Frgke === "R";

              case "Processing":
                return r.Frgke === "C" && !r.IsRejected;

              case "Processing (ReasonID)":
                return r.Frgke === "C" && r.IsRejected;

              default:
                return true;
            }
          });
        }

        // ====== APPLY RESULT ======
        this.getView().setModel(new JSONModel(aResult), "po");

        sap.m.MessageToast.show(`🔍 Found ${aResult.length} PO(s)`);
      },

      onValueHelpPO: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        this._createSimpleValueHelp(
          oEvent,
          "PO Number",
          "Ebeln",
          aData.map((i) => i.Ebeln)
        );
      },

      onValueHelpOrderType: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aTypes = [...new Set(aData.map((i) => i.Bsart))];
        this._createSimpleValueHelp(oEvent, "Order Type", "Bsart", aTypes);
      },

      onValueHelpEkgrp: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aGroups = [...new Set(aData.map((i) => i.Ekgrp))];
        this._createSimpleValueHelp(oEvent, "Purch. Group", "Ekgrp", aGroups);
      },

      onValueHelpErnam: function (oEvent) {
        const aData = this.getView().getModel("po").getData() || [];
        const aUsers = [...new Set(aData.map((i) => i.Ernam))];
        this._createSimpleValueHelp(oEvent, "Created By", "Ernam", aUsers);
      },

      onExportExcel: function () {
        const oTable = this.byId("poTable");
        const oModel = oTable.getModel("po"); // ⭐ dùng đúng model name
        const aData = oModel.getData() || []; // ⭐ lấy thẳng mảng

        if (!aData.length) {
          return MessageToast.show("⚠️ No data to export!");
        }

        const aCols = [
          { label: "Purchase Order", property: "Ebeln" },
          { label: "Order Type", property: "Bsart" },
          { label: "Purchasing Group", property: "Ekgrp" },
          { label: "Created By", property: "Ernam" },
          { label: "Created Date", property: "Aedat", type: "date" }, // ⭐ thêm type để Excel hiểu ngày
        ];

        const oSheet = new Spreadsheet({
          workbook: { columns: aCols },
          dataSource: aData,
          fileName: "PO_List_Export.xlsx",
        });

        oSheet
          .build()
          .then(() => MessageToast.show("✅ Export successful!"))
          .finally(() => oSheet.destroy());
      },

      onRefresh: function () {
        MessageToast.show("🔄 Reloading PO list...");
        this._loadPOList(); // ⭐ GỌI LẠI LOGIC LOAD THẬT
      },

      onNavHome: function () {
        const oRouter = this.getOwnerComponent().getRouter();

        // Reset detail panel (nếu có)
        const oDetailPanel = this.byId("poDetailPanel");
        if (oDetailPanel) {
          oDetailPanel.setVisible(false);
        }

        // Clear selected item
        const oTable = this.byId("poTable");
        if (oTable) {
          oTable.removeSelections(true);
        }

        // Điều hướng về Dashboard
        oRouter.navTo("DashboardPR", {}, true); // replace history = true
      },

      // ============================
      // LOAD PO LIST
      _loadPOList: function () {
        sap.ui.core.BusyIndicator.show(0);

        const oModel = this.oODataModel;

        /* =====================================================
         * STEP 1 — lấy EKET để xác định danh sách PO
         * ===================================================== */
        const pEket = new Promise((resolve, reject) => {
          oModel.read("/EKET001Set", {
            success: (d) => resolve(d.results || []),
            error: reject,
          });
        });

        pEket
          .then((aEket) => {
            if (!aEket.length) {
              this.getView().setModel(new JSONModel([]), "po");
              this._originalPOData = [];
              sap.ui.core.BusyIndicator.hide();
              MessageToast.show("No PO found.");
              return null;
            }

            /* =====================================================
             * STEP 2 — unique EBELN
             * ===================================================== */
            const aPO = [...new Set(aEket.map((e) => e.Ebeln))];
            if (!aPO.length) return null;

            const oPOFilter = new Filter({
              filters: aPO.map(
                (p) => new Filter("Ebeln", FilterOperator.EQ, p)
              ),
              and: false,
            });

            /* =====================================================
             * STEP 3 — HEADER / ITEMS / REJECT LOG (SONG SONG)
             * ===================================================== */
            const pHeader = new Promise((resolve, reject) => {
              oModel.read("/ProcurementHeaderSet", {
                filters: [
                  oPOFilter,
                  new Filter("Bstyp", FilterOperator.EQ, "F"), // PO only
                ],
                success: (d) => resolve(d.results || []),
                error: reject,
              });
            });

            const pItems = new Promise((resolve, reject) => {
              oModel.read("/ProcurementItemSet", {
                success: (d) => resolve(d.results || []),
                error: reject,
              });
            });

            const pRejectLog = new Promise((resolve, reject) => {
              oModel.read("/Reject_PO_LogSet", {
                success: (d) => resolve(d.results || []),
                error: reject,
              });
            });

            const pRejectReasonMaster = new Promise((resolve, reject) => {
              oModel.read("/Reject_POSet", {
                success: (d) => resolve(d.results || []),
                error: reject,
              });
            });

            return Promise.all([
              pHeader,
              pItems,
              pRejectLog,
              pRejectReasonMaster,
            ]);
          })
          .then((result) => {
            if (!result) return;

            const [aHeader, aItems, aRejectLogs, aRejectReasons] = result;

            /* =====================================================
             * STEP 4 — map Items theo EBELN
             * ===================================================== */
            const itemMap = {};
            aItems.forEach((it) => {
              if (!itemMap[it.Ebeln]) itemMap[it.Ebeln] = [];
              itemMap[it.Ebeln].push(it);
            });

            /* =====================================================
             * STEP 5 — map Reject Log theo EBELN
             * ===================================================== */
            const rejectMap = {};
            aRejectLogs.forEach((r) => {
              // nếu nhiều record → record mới nhất ghi đè
              rejectMap[r.Ebeln] = r;
            });

            const reasonTextMap = {};
            aRejectReasons.forEach((r) => {
              reasonTextMap[r.ReasonId] = r.Description;
            });

            /* =====================================================
             * STEP 6 — enrich Header (⭐ QUAN TRỌNG)
             * ===================================================== */
            aHeader.forEach((h) => {
            h.Items = itemMap[h.Ebeln] || [];
            h.ItemCount = h.Items.length;

            const log = rejectMap[h.Ebeln];

            // ✅ CHỈ REJECT KHI Frgke = C VÀ CÓ LOG
            const isRejected = h.Frgke === "C" && !!log;

            h.IsRejected = isRejected;
            h.RejectReasonId = isRejected ? log.ReasonId : "";
            h.RejectReasonText = isRejected
              ? reasonTextMap[log.ReasonId] || ""
              : "";
          });


            /* =====================================================
             * STEP 7 — set Model
             * ===================================================== */
            this.getView().setModel(new JSONModel(aHeader), "po");
            this._originalPOData = JSON.parse(JSON.stringify(aHeader));

            sap.ui.core.BusyIndicator.hide();
            MessageToast.show(`${aHeader.length} POs loaded`);
          })
          .catch((err) => {
            console.error("❌ Load PO failed:", err);
            sap.ui.core.BusyIndicator.hide();
            MessageBox.error("Failed to load PO list.");
          });
      },

      _createSimpleValueHelp: function (oEvent, sTitle, sKey, aValues) {
        // Convert values -> [{ key: "..."}]
        const aRows = aValues.map((v) => {
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
              template: new sap.m.Text({ text: `{${sKey}}` }),
            }),
          ],
        });

        oTable.setModel(oRowsModel);
        oTable.bindRows("/rows");

        // ===== SEARCH FIELD =====
        const oSearch = new sap.m.SearchField({
          width: "100%",
          placeholder: "Search...",
          liveChange: (e) => {
            const q = (e.getParameter("newValue") || "").toUpperCase();

            const filtered = aRows.filter((r) =>
              String(r[sKey]).toUpperCase().includes(q)
            );

            // Cập nhật model khi search
            oRowsModel.setData({ rows: filtered });
          },
        });

        // ===== FILTER BAR =====
        const oFilterBar = new sap.ui.comp.filterbar.FilterBar({
          advancedMode: false,
          filterGroupItems: [],
          basicSearch: oSearch,
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
            const aSelected = aIdx.map(
              (i) => oTable.getContextByIndex(i).getObject()[sKey]
            );

            oMI.removeAllTokens();
            aSelected.forEach((v) =>
              oMI.addToken(new sap.m.Token({ key: v, text: v }))
            );

            oVH.close();
          },

          cancel: () => oVH.close(),
        });

        // Áp dụng FilterBar & Table cho VHD
        oVH.setFilterBar(oFilterBar);

        // phải dùng oVH.setTable() cho Smart ValueHelpDialog
        oVH.setTable(oTable);

        oVH.open();
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
            CanEdit: true, // ✅ Mặc định: ai cũng có thể edit
          });
        this.getView().setModel(oNoteModel, "poNoteModel");

        const sKeyEbeln = String(sEbeln || "")
          .trim()
          .padStart(10, "0");
        oNoteModel.setProperty("/Ebeln", sKeyEbeln);
        oNoteModel.setProperty("/Note", "Loading...");
        oNoteModel.setProperty("/Editable", false);
        oNoteModel.setProperty("/CanEdit", true); // ✅ Luôn true

        sap.ui.core.BusyIndicator.show(0);

        // Không cần lấy user nữa vì ai cũng có quyền
        oModel.read(`/PONoteSet(Ebeln='${sKeyEbeln}')`, {
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();
            oNoteModel.setProperty(
              "/Note",
              oData.Note || "— No note available —"
            );
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

      onCloseDetail: function () {
        this.byId("poDetailPanel").setVisible(false);
        this.byId("poTablePane").getLayoutData().setSize("100%");
        this.byId("poTable").removeSelections(true);
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
              },
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
              },
            });
          },
        });
      },

      onApprovePO: function () {
        const oPO = this.getView().getModel("detailPO").getData();

        if (!oPO || !oPO.Ebeln) {
          return MessageToast.show("⚠️ No PO selected.");
        }

        /* ===============================
         * ✅ VALIDATION NGHIỆP VỤ
         * =============================== */
        if (oPO.Frgke !== "C") {
          return MessageBox.error("❌ Only Pending PO can be approved.");
        }

        if (oPO.IsRejected) {
          return MessageBox.error("❌ Rejected PO cannot be approved.");
        }

        const sEbeln = String(oPO.Ebeln).padStart(10, "0");

        /* ===============================
         * ✅ CONFIRM
         * =============================== */
        MessageBox.confirm(`Approve PO ${sEbeln}?`, {
          onClose: (sAction) => {
            if (sAction !== MessageBox.Action.OK) return;

            sap.ui.core.BusyIndicator.show(0);

            const oModel = this.oODataModel;
            const sPath = `/ProcurementHeaderSet(Ebeln='${sEbeln}')`;

            const oPayload = {
              Ebeln: sEbeln,
              Frgke: "R", // ✅ Approved
            };

            oModel.update(sPath, oPayload, {
             success: () => {
  sap.ui.core.BusyIndicator.hide();

  // ✅ FIX 1: clear reject state NGAY LẬP TỨC
  const oDetailModel = this.getView().getModel("detailPO");
  if (oDetailModel) {
    oDetailModel.setProperty("/Frgke", "R");
    oDetailModel.setProperty("/IsRejected", false);
    oDetailModel.setProperty("/RejectReasonId", "");
    oDetailModel.setProperty("/RejectReasonText", "");
  }

  MessageToast.show(`✅ PO ${sEbeln} approved successfully`);

  // ✅ FIX 2: reload list & detail
  this._loadPOList();
  this._refreshPOAfterAction(sEbeln);
},

              error: (err) => {
                sap.ui.core.BusyIndicator.hide();
                console.error(err);
                MessageBox.error("❌ Failed to approve PO.");
              },
            });
          },
        });
      },

      onRejectPO: function () {
        const oDetailModel = this.getView().getModel("detailPO");
        const oPO = oDetailModel?.getData();

        if (!oPO || !oPO.Ebeln) {
          return sap.m.MessageToast.show("⚠️ No PO selected.");
        }

        /* ===============================
         * 1️⃣ CHỈ REJECT KHI PO = APPROVED
         * =============================== */
        if (oPO.Frgke !== "R") {
          return sap.m.MessageBox.error("❌ Only Approved PO can be rejected.");
        }

        if (oPO.IsRejected === true) {
          return sap.m.MessageBox.error(
            "❌ This PO has already been rejected."
          );
        }

        const sEbeln = String(oPO.Ebeln).padStart(10, "0");

        /* ===============================
         * 2️⃣ POPUP CHỌN REJECT REASON
         * =============================== */
        const oSelect = new sap.m.Select({ width: "100%" });

        this._aRejectPOReasons
          .filter((r) => r.Type === "F") // ⭐ CHẮC CHẮN PO
          .forEach((r) => {
            oSelect.addItem(
              new sap.ui.core.Item({
                key: r.ReasonId,
                text: `${r.ReasonId} - ${r.Description}`,
              })
            );
          });

        const oDialog = new sap.m.Dialog({
          title: "Reject PO " + sEbeln,
          type: "Message",
          contentWidth: "420px",
          content: [
            new sap.m.VBox({
              items: [
                new sap.m.Text({
                  text: "Please select reject reason:",
                }),
                oSelect,
              ],
            }),
          ],

          beginButton: new sap.m.Button({
            text: "Reject",
            type: "Reject",
            press: () => {
              const sReason = oSelect.getSelectedKey();
              if (!sReason) {
                return sap.m.MessageToast.show(
                  "⚠️ Please select reject reason."
                );
              }

              oDialog.close();
              this._executeRejectPO(sEbeln, sReason);
            },
          }),

          endButton: new sap.m.Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),

          afterClose: () => oDialog.destroy(),
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      _executeRejectPO: function (sEbeln, sReasonId) {
        const oModel = this.oODataModel;
        sap.ui.core.BusyIndicator.show(0);

        const sPath = `/ProcurementHeaderSet(Ebeln='${sEbeln}')`;

        const oPayload = {
          Ebeln: sEbeln,
          Frgke: "C", // R → C (reject)
        };

        // ⭐ GỬI REASON_ID QUA HEADER - Đặt trực tiếp trong update()
        oModel.update(sPath, oPayload, {
          headers: {
            "X-Reason-Id": sReasonId, // ✅ Custom header
          },
          success: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show(`❌ PO ${sEbeln} rejected successfully`);

            // Reload list và refresh detail
            this._loadPOList();
            this._refreshPOAfterAction(sEbeln);
          },
          error: (err) => {
            sap.ui.core.BusyIndicator.hide();
            console.error("❌ Reject PO failed:", err);

            // Parse error message
            let sErrorMsg = "Failed to reject PO.";
            if (err.responseText) {
              try {
                const oError = JSON.parse(err.responseText);
                sErrorMsg = oError.error?.message?.value || sErrorMsg;
              } catch (e) {
                // Ignore parse error
              }
            }

            sap.m.MessageBox.error(`❌ ${sErrorMsg}`);
          },
        });
      },

      _loadRejectPOReasons: function () {
        const oModel = this.oODataModel;

        return new Promise((resolve, reject) => {
          oModel.read("/Reject_POSet", {
            filters: [
              new sap.ui.model.Filter(
                "Type",
                sap.ui.model.FilterOperator.EQ,
                "F" // ⭐ PO ONLY
              ),
            ],
            success: (d) => {
              this._aRejectPOReasons = d.results || [];
              resolve(this._aRejectPOReasons);
            },
            error: reject,
          });
        });
      },

      onSortCreatedDate: function () {
        const oTable = this.byId("poTable");
        const oBinding = oTable.getBinding("items");

        // Tăng trạng thái: 0 → 1 → 2 → 0
        this._createdDateSortState = (this._createdDateSortState + 1) % 3;

        let aSorters = [];

        if (this._createdDateSortState === 1) {
          // ASC
          aSorters.push(new sap.ui.model.Sorter("Aedat", false));
          MessageToast.show("🔼 Sorted by Created Date (Ascending)");
        } else if (this._createdDateSortState === 2) {
          // DESC
          aSorters.push(new sap.ui.model.Sorter("Aedat", true));
          MessageToast.show("🔽 Sorted by Created Date (Descending)");
        } else {
          // ⛔ RESET VỀ THỨ TỰ GỐC
          const oOriginalModel = new JSONModel(this._originalPOData);
          this.getView().setModel(oOriginalModel, "po");

          MessageToast.show("↩️ Sort reset (Back to original order)");
          return;
        }

        // Apply sorting
        oBinding.sort(aSorters);
      },

      _refreshPOAfterAction: function (sEbeln) {
        const oModel = this.getView().getModel();

        sap.ui.core.BusyIndicator.show(0);

        const pHeader = new Promise((resolve, reject) => {
          oModel.read("/ProcurementHeaderSet", {
            filters: [
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                sEbeln
              ),
            ],
            success: (d) => resolve(d.results[0]),
            error: reject,
          });
        });

        const pItems = new Promise((resolve, reject) => {
          oModel.read("/ProcurementItemSet", {
            filters: [
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                sEbeln
              ),
            ],
            success: (d) => resolve(d.results),
            error: reject,
          });
        });

        const pRejectLog = new Promise((resolve, reject) => {
          oModel.read("/Reject_PO_LogSet", {
            filters: [
              new sap.ui.model.Filter(
                "Ebeln",
                sap.ui.model.FilterOperator.EQ,
                sEbeln
              ),
            ],
            success: (d) => resolve(d.results),
            error: reject,
          });
        });

        const pRejectReason = new Promise((resolve, reject) => {
          oModel.read("/Reject_POSet", {
            success: (d) => resolve(d.results),
            error: reject,
          });
        });
          Promise.all([pHeader, pItems, pRejectLog, pRejectReason])
            .then(([header, items, rejectLogs, reasons]) => {
              sap.ui.core.BusyIndicator.hide();
              if (!header) return;

              header.Items = items || [];
              header.ItemCount = header.Items.length;

              // ✅ map reason master
              const reasonMap = {};
              (reasons || []).forEach((r) => {
                reasonMap[r.ReasonId] = r.Description;
              });

              const log = rejectLogs && rejectLogs[0];

              // ✅ CHỈ reject khi Frgke = C
              const isRejected = header.Frgke === "C" && !!log;

              header.IsRejected = isRejected;
              header.RejectReasonId = isRejected ? log.ReasonId : "";
              header.RejectReasonText = isRejected
                ? reasonMap[log.ReasonId] || ""
                : "";

              this.getView().getModel("detailPO").setData(header);

              MessageToast.show(`🔄 PO ${sEbeln} refreshed successfully`);
            });

      },

      onGoToDashboard: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("DashboardPR");
      },

      onGoToPRList: function () {
        this.getOwnerComponent().getRouter().navTo("PRList");
      },
      onGoToRFQList: function () {
        this.getOwnerComponent().getRouter().navTo("RFQList");
      },
    });
  }
);
