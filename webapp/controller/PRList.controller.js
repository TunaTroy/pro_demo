sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  function (
    Controller,
    ODataModel,
    MessageToast,
    Spreadsheet,
    JSONModel,
    Filter,
    FilterOperator
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.PRList", {
      // =========================================================
      // FORMATTERS
      // =========================================================
      formatter: {
        statusText: function (s) {
          switch (s) {
            case "R":
              return "Approved"; // hoặc "Completed"
            case "C":
              return "Pending"; // hoặc "Released"
            case "X":
              return "Rejected";
            case "":
            case null:
            case undefined:
              return "None";
            default:
              return "Nullable"; // bất kỳ giá trị khác R/C/X thì trả về Nullable
          }
        },

        statusState: function (s) {
          switch (s) {
            case "R":
              return "Success";
            case "C":
              return "Warning";
            case "X":
              return "Error";
            default:
              return "None"; // “None” hiển thị màu xám nhạt trung tính
          }
        },

        statusBarStatePercent: function (percent) {
          if (percent === 100) return "Success";
          if (percent > 0) return "Warning";
          return "Error";
        },

        dateFormat: function (sDate) {
          if (!sDate) return "";
          const oDate = new Date(sDate);
          return oDate.toLocaleDateString("en-GB");
        },
        padBanfn: function (sBanfn) {
          if (!sBanfn) return "";
          return String(sBanfn).trim().padStart(10, "0");
        },
        docTypeText: function (sBsart) {
          if (!sBsart) return "";
          const map = {
            NB: "Purchase Requisition",
            ZNB1: "Service PR Type 1",
            ZNB2: "Service PR Type 2",
            ZNB3: "Maintenance PR",
            ZNB4: "Material Request",
            ZNB5: "Internal Purchase",
            ZNB6: "Stock PR",
            ZNB7: "Subcontracting PR",
            ZNB8: "External Purchase",
            ZNB9: "Repair PR",
            AN: "Quotation Request",
            UB: "Stock Transfer",
          };
          const desc = map[sBsart] || "Unknown Type";
          return `${desc} (${sBsart})`;
        },
        detailStatusText: function (s) {
          if (!s) return "None"; // không có giá trị
          switch (s) {
            case "R":
              return "Approved";
            case "C":
              return "Pending";
            case "X":
              return "Rejected";
            default:
              return "Nullable"; // giá trị khác R/C/X
          }
        },

        quantityFormat: function (value) {
          if (value === undefined || value === null || value === "") return "";
          // Ép kiểu về số và làm tròn tối đa 3 chữ số thập phân
          const num = parseFloat(value);
          if (isNaN(num)) return value;
          // Nếu là số nguyên thì hiển thị nguyên, nếu có phần thập phân thì hiển thị gọn
          return num % 1 === 0 ? num.toString() : num.toFixed(3);
        },

        // =========================================================
        // DETAIL STATUS (dựa theo % release)
        // =========================================================
        detailPercentStatusText: function (percent) {
          if (percent === undefined || percent === null) return "None";
          if (percent === 0) return "Nullable";
          if (percent > 0 && percent <= 40) return "In Progress (Low)";
          if (percent > 40 && percent < 80) return "In Progress (Medium)";
          if (percent >= 80 && percent < 100) return "Almost Approved";
          if (percent === 100) return "Approved";
          return "Unknown";
        },

        detailPercentStatusState: function (percent) {
          if (percent === undefined || percent === null) return "None";
          if (percent === 0) return "Error";
          if (percent > 0 && percent <= 40) return "Warning";
          if (percent > 40 && percent < 80) return "Information";
          if (percent >= 80 && percent < 100) return "Success";
          if (percent === 100) return "Success";
          return "None";
        },
      },

      // =========================================================
      // INIT
      // =========================================================
      onInit: function () {
        const sServiceUrl = "/sap/opu/odata/sap/ZGW_PRO_G18_SRV/";
        const oModel = new ODataModel(sServiceUrl, {
          useBatch: false,
          json: true,
        });
        this.getView().setModel(oModel);
        this.byId("detailPanel").setVisible(false);
        this.onGoFilter();
      },

      // =========================================================
      // FILTER + SORT + GROUP
      // =========================================================
      onGoFilter: function () {
        const oView = this.getView();
        const oModel = oView.getModel();
        const oTable = oView.byId("tblPRList");

        const sBanfn = oView.byId("inpBanfn").getValue().trim();
        const sBsart = oView.byId("inpBsart").getValue().trim();
        const sEkgrp = oView.byId("inpEkgrp").getValue().trim();
        const sErnam = oView.byId("inpErnam").getValue().trim();

        const aFilters = [];
        if (sBanfn)
          aFilters.push(new Filter("Banfn", FilterOperator.Contains, sBanfn));
        if (sBsart)
          aFilters.push(new Filter("Bsart", FilterOperator.Contains, sBsart));
        if (sEkgrp)
          aFilters.push(new Filter("Ekgrp", FilterOperator.Contains, sEkgrp));
        if (sErnam)
          aFilters.push(new Filter("Ernam", FilterOperator.Contains, sErnam));

        // 🔹 DATE RANGE FILTER
        const oDateRange = oView.byId("inpDateRange");
        if (oDateRange) {
          const dFrom = oDateRange.getDateValue();
          const dTo = oDateRange.getSecondDateValue();
          if (dFrom && dTo)
            aFilters.push(new Filter("Badat", FilterOperator.BT, dFrom, dTo));
          else if (dFrom)
            aFilters.push(new Filter("Badat", FilterOperator.GE, dFrom));
          else if (dTo)
            aFilters.push(new Filter("Badat", FilterOperator.LE, dTo));
        }

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          filters: aFilters,
          urlParameters: { $top: 10000, $orderby: "Banfn asc" },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();
            const all = data.results || [];

            const groups = [];
            all.forEach((row) => {
              let g = groups.find((gg) => gg.Banfn === row.Banfn);
              if (!g) {
                g = {
                  Banfn: row.Banfn,
                  Bsart: row.Bsart,
                  Ekgrp: row.Ekgrp,
                  Ernam: row.Ernam,
                  Badat: row.Badat,
                  Items: [row],
                };
                groups.push(g);
              } else g.Items.push(row);
            });

            groups.forEach((g) => {
              g.ItemCount = g.Items.length;
              const approved = g.Items.filter((it) => it.Frgkz === "R").length;
              g.StatusPercent = g.ItemCount
                ? Math.round((approved / g.ItemCount) * 100)
                : 0;
              g.StatusDisplay = g.StatusPercent + "%";
            });

            oTable.setModel(new JSONModel({ groups }));
            MessageToast.show(
              `✅ Loaded ${groups.length} PRs (${all.length} records).`
            );
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("❌ Error loading data from server.");
          },
        });
      },

      // =========================================================
      // CLEAR FILTER
      // =========================================================
      onClearFilter: function () {
        const oView = this.getView();
        ["inpBanfn", "inpBsart", "inpEkgrp", "inpErnam"].forEach((id) => {
          if (oView.byId(id)) oView.byId(id).setValue("");
        });
        if (oView.byId("inpDateRange")) oView.byId("inpDateRange").setValue("");
        this.onGoFilter();
        MessageToast.show("🔄 Filters cleared.");
      },

      // =========================================================
      // DETAIL PANEL — Header + EBAN items (intersect với list trái)
      // =========================================================
      onSelectPR: function (oEvent) {
        const oItem = oEvent.getParameter("listItem");
        const oCtx = oItem.getBindingContext();
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        const oModel = this.getView().getModel();

        if (!oCtx) return;

        const group = oCtx.getObject();
        const sBanfn = group.Banfn;

        // 1) Lấy “item keys” từ dataset bên trái (đã được lọc)
        //    Key ưu tiên: Bnfpo + (Matnr hoặc Txz01). Fallback: chỉ Bnfpo.
        const pad5 = (v) =>
          String(v || "")
            .trim()
            .padStart(5, "0");
        const aLeftItems = Array.isArray(group.Items) ? group.Items : [];

        const hasMatnrOrTxz = aLeftItems.some((it) => it.Matnr || it.Txz01);
        const leftKey = (it) => {
          const k1 = pad5(it.Bnfpo);
          const k2 = (it.Matnr || it.Txz01 || "").trim();
          return hasMatnrOrTxz ? `${k1}|${k2}` : k1;
        };
        const leftKeySet = new Set(aLeftItems.map(leftKey));

        // 2) Tạo model header trước
        const oDetailModel = new sap.ui.model.json.JSONModel({
          Banfn: group.Banfn,
          Bsart: group.Bsart,
          Ekgrp: group.Ekgrp,
          Ernam: group.Ernam,
          Badat: group.Badat,
          Frgkz: group.Frgkz,
          Items: [], // sẽ cập nhật sau khi gọi EBAN
        });

        // 3) Đọc EBAN theo Banfn rồi lọc giao với list trái
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/ebanSet", {
          filters: [
            new sap.ui.model.Filter(
              "Banfn",
              sap.ui.model.FilterOperator.EQ,
              sBanfn
            ),
          ],
          success: (oData) => {
            sap.ui.core.BusyIndicator.hide();
            const aEban = oData?.results || [];

            const ebanKey = (it) => {
              const k1 = pad5(it.Bnfpo);
              const k2 = (it.Matnr || it.Txz01 || "").trim();
              return hasMatnrOrTxz ? `${k1}|${k2}` : k1;
            };

            // Intersect theo key
            let aIntersect = aEban.filter((it) => leftKeySet.has(ebanKey(it)));

            // Nếu intersect rỗng (thiếu field để match), fallback: lọc theo Bnfpo
            if (aIntersect.length === 0) {
              const leftBnfpoSet = new Set(
                aLeftItems.map((it) => pad5(it.Bnfpo))
              );
              aIntersect = aEban.filter((it) =>
                leftBnfpoSet.has(pad5(it.Bnfpo))
              );
            }

            // (Optional) Sắp xếp cho đẹp
            aIntersect.sort((a, b) =>
              pad5(a.Bnfpo).localeCompare(pad5(b.Bnfpo))
            );

            // 4) Bind header + items
            oDetailModel.setProperty("/Items", aIntersect);
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            oDetail.setVisible(true);
            oLayout.setSize("65%");
            this.byId("txtPRTitle").setText(group.Banfn);

            const oItemTable = this.byId("tblPRItems");
            if (oItemTable) oItemTable.setModel(oDetailModel);
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            // fallback: hiển thị đúng những gì list trái đang có (nếu EBAN fail)
            oDetailModel.setProperty("/Items", aLeftItems);
            oDetail.setModel(oDetailModel);
            oDetail.bindElement("/");
            oDetail.setVisible(true);
            oLayout.setSize("65%");
            this.byId("txtPRTitle").setText(group.Banfn);

            MessageToast.show(
              `⚠️ Không tải được EBAN cho PR ${sBanfn}. Hiển thị theo danh sách hiện tại.`
            );
          },
        });
      },

      onCloseDetail: function () {
        const oDetail = this.byId("detailPanel");
        const oLayout = this.byId("layoutMaster");
        oDetail.setVisible(false);
        oLayout.setSize("100%");
        this.byId("tblPRList").removeSelections();
      },


      onSelectItem: function (oEvent) {
        const oSelectedItem = oEvent.getParameter("listItem");
        const oCtx = oSelectedItem.getBindingContext();
        if (!oCtx) return;

        const oItemData = oCtx.getObject();
        const oDetailPanelModel = this.byId("detailPanel").getModel();
        const sBanfn = oDetailPanelModel.getProperty("/Banfn");
        const sBnfpo = oItemData.Bnfpo;

        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("PRItemDetail", {
          Banfn: sBanfn,
          Bnfpo: sBnfpo,
        });
      },

     



      // =========================================================
      // EXPORT TO EXCEL
      // =========================================================
      onExportExcel: function () {
        const oTable = this.byId("tblPRList");
        const aData = oTable.getModel()?.getData()?.groups || [];
        if (!aData.length) return MessageToast.show("⚠️ No data to export!");

        const aCols = [
          { label: "Purchase Requisition", property: "Banfn" },
          { label: "Document Type", property: "Bsart" },
          { label: "Purchasing Group", property: "Ekgrp" },
          { label: "Created By", property: "Ernam" },
          { label: "Requisition Date", property: "Badat" },
        ];

        const oSheet = new Spreadsheet({
          workbook: { columns: aCols },
          dataSource: aData,
          fileName: "PR_List_Export.xlsx",
        });

        oSheet
          .build()
          .then(() => MessageToast.show("✅ Export successful!"))
          .finally(() => oSheet.destroy());
      },

      onNavHome: function () {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        if (oRouter) oRouter.navTo("DashBoard");
        else MessageToast.show("🔙 Back to Home");
      },
    });
  }
);
