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
        // ===== Load Cache for ValueHelp =====
        this._loadCaches();
      },

      // =========================================================
      // FILTER + SORT + GROUP
      // =========================================================
      onGoFilter: function () {
        const oView = this.getView();
        const oModel = oView.getModel();
        const oTable = oView.byId("tblPRList");

        // 🔹 Chuẩn hóa lại các trường: nếu người dùng đã xóa text thì clear luôn selectedKey
        ["inpBanfn", "inpBsart", "inpEkgrp", "inpErnam"].forEach((id) => {
          const oInp = oView.byId(id);
          if (oInp && !oInp.getValue().trim()) oInp.data("selectedKey", "");
        });

        // Lấy giá trị thực từ field (ưu tiên selectedKey nếu có)
        const getKey = (id) => {
          const oInp = oView.byId(id);
          const key = oInp?.data("selectedKey")?.trim();
          return key && key !== "" ? key : oInp?.getValue()?.trim();
        };

        const sBanfn = getKey("inpBanfn");
        let sBsart = getKey("inpBsart");
        const sEkgrp = getKey("inpEkgrp");
        const sErnam = getKey("inpErnam");

        // 🧩 Nếu user gõ tay hoặc chọn từ value help → lọc code Bsart trong ngoặc
        if (sBsart && sBsart.includes("(")) {
          const match = sBsart.match(/\(([^)]+)\)$/);
          if (match && match[1]) {
            sBsart = match[1]; // chỉ lấy phần code trong ngoặc
          }
        }

        const oDateRange = oView.byId("inpDateRange");
        const dFrom = oDateRange?.getDateValue();
        const dTo = oDateRange?.getSecondDateValue();

        // 🔹 Tạo mảng filter
        const aFilters = [];
        if (sBanfn)
          aFilters.push(
            new sap.ui.model.Filter(
              "Banfn",
              sap.ui.model.FilterOperator.Contains,
              sBanfn
            )
          );
        if (sBsart)
          aFilters.push(
            new sap.ui.model.Filter(
              "Bsart",
              sap.ui.model.FilterOperator.EQ,
              sBsart
            )
          );
        if (sEkgrp)
          aFilters.push(
            new sap.ui.model.Filter(
              "Ekgrp",
              sap.ui.model.FilterOperator.Contains,
              sEkgrp
            )
          );
        if (sErnam)
          aFilters.push(
            new sap.ui.model.Filter(
              "Ernam",
              sap.ui.model.FilterOperator.EQ,
              sErnam.toUpperCase()
            )
          );
        if (dFrom && dTo)
          aFilters.push(
            new sap.ui.model.Filter(
              "Badat",
              sap.ui.model.FilterOperator.BT,
              dFrom,
              dTo
            )
          );
        else if (dFrom)
          aFilters.push(
            new sap.ui.model.Filter(
              "Badat",
              sap.ui.model.FilterOperator.GE,
              dFrom
            )
          );
        else if (dTo)
          aFilters.push(
            new sap.ui.model.Filter(
              "Badat",
              sap.ui.model.FilterOperator.LE,
              dTo
            )
          );

        // 🔸 Nếu không có bất kỳ filter nào → load toàn bộ danh sách
        const bNoFilter =
          !sBanfn && !sBsart && !sEkgrp && !sErnam && !dFrom && !dTo;

        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          filters: bNoFilter ? [] : aFilters,
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

            oTable.setModel(new sap.ui.model.json.JSONModel({ groups }));
            sap.m.MessageToast.show(
              bNoFilter
                ? `📋 Loaded all ${groups.length} PRs (${all.length} records).`
                : `✅ Loaded ${groups.length} filtered PRs (${all.length} records).`
            );
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("❌ Error loading data from server.");
          },
        });
      },

      // =========================================================
      // CLEAR FILTER
      // =========================================================
      onClearFilter: function () {
        const oView = this.getView();

        // 🔹 Reset toàn bộ các input filter
        ["inpBanfn", "inpBsart", "inpEkgrp", "inpErnam"].forEach((id) => {
          const oInp = oView.byId(id);
          if (oInp) {
            oInp.setValue(""); // clear text hiển thị
            oInp.data("selectedKey", ""); // clear key ẩn (giá trị thật)
          }
        });

        // 🔹 Reset DateRange
        const oDateRange = oView.byId("inpDateRange");
        if (oDateRange) oDateRange.setValue("");

        // 🔹 Reload lại data
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

  // 🔹 Dữ liệu dòng item được chọn trong bảng Items
  const oItemData = oCtx.getObject();

  // 🔹 Lấy Banfn từ model của panel chi tiết
  const oDetailPanelModel = this.byId("detailPanel").getModel();
  let sBanfn = oDetailPanelModel.getProperty("/Banfn");
  let sBnfpo = oItemData.Bnfpo;

  // 🔹 Đảm bảo key đúng định dạng backend (Banfn = CHAR(10), Bnfpo = CHAR(5))
  if (sBanfn) sBanfn = sBanfn.toString().padStart(10, "0");
  if (sBnfpo) sBnfpo = sBnfpo.toString().padStart(5, "0");

  console.log("➡️ Navigating to PRItemDetail with:", sBanfn, sBnfpo);

  // 🔹 Điều hướng sang màn PRItemDetail
  const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
  oRouter.navTo("PRItemDetail", {
    Banfn: sBanfn,
    Bnfpo: sBnfpo
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

      // =========================================================
      // CACHES FOR VALUE HELP
      // =========================================================
      _loadCaches: function () {
        const oModel = this.getView().getModel();
        const that = this;

        oModel.read("/DocTypeSet", {
          success: (d) => {
            that._oDocTypeCache = new JSONModel(d.results);
          },
          error: () => console.warn("DocTypeSet not loaded"),
        });

        oModel.read("/PurchGroupSet", {
          success: (d) => {
            that._oPurchGroupCache = new JSONModel(d.results);
          },
          error: () => console.warn("PurchGroupSet not loaded"),
        });

        oModel.read("/UserSet", {
          success: (d) => {
            that._oUserCache = new JSONModel(d.results);
          },
          error: () => console.warn("UserSet not loaded"),
        });
      },

      // =========================================================
      // VALUE HELP DIALOGS
      // =========================================================
      onValueHelpBanfn: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        // Hàm pad số PR cho đẹp (10 ký tự)
        const padBanfn = (sBanfn) =>
          String(sBanfn || "")
            .trim()
            .padStart(10, "0");

        if (!this._oBanfnDialog) {
          this._oBanfnDialog = new sap.m.SelectDialog({
            title: "Select Purchase Requisition",
            search: (e) => {
              const sVal = e.getParameter("value")?.trim();
              e.getSource()
                .getBinding("items")
                .filter([
                  new sap.ui.model.Filter(
                    "Banfn",
                    sap.ui.model.FilterOperator.Contains,
                    sVal
                  ),
                ]);
            },
            confirm: (e) => {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sBanfn = oItem.getTitle();
                oView.byId("inpBanfn").setValue(sBanfn);
                oView.byId("inpBanfn").data("selectedKey", sBanfn);
              }
            },
            items: {
              path: "/uniqueBanfn",
              template: new sap.m.StandardListItem({
                title: "{Banfn}",
              }),
            },
          });
        }

        // 🔹 Đọc dữ liệu PRsSet rồi lọc unique Banfn và pad 10 ký tự
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 5000, $orderby: "Banfn asc" },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();

            const unique = [];
            const seen = new Set();
            (data.results || []).forEach((row) => {
              const padded = padBanfn(row.Banfn);
              if (!seen.has(padded)) {
                seen.add(padded);
                unique.push({ Banfn: padded });
              }
            });

            const oLocalModel = new sap.ui.model.json.JSONModel({
              uniqueBanfn: unique,
            });
            this._oBanfnDialog.setModel(oLocalModel);
            this._oBanfnDialog.open();
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show(
              "❌ Cannot load Purchase Requisition list."
            );
          },
        });
      },

      onValueHelpBsart: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        // 🧩 Mapping mô tả Document Type — giống formatter.docTypeText
        const docTypeMap = {
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

        // Nếu dialog chưa tạo → tạo mới
        if (!this._oBsartDialog) {
          this._oBsartDialog = new sap.m.SelectDialog({
            title: "Select Document Type",
            search: (e) => {
              const sVal = e.getParameter("value")?.trim().toUpperCase();
              e.getSource()
                .getBinding("items")
                .filter([
                  new sap.ui.model.Filter(
                    "Bsart",
                    sap.ui.model.FilterOperator.Contains,
                    sVal
                  ),
                ]);
            },
            confirm: (e) => {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sBsart = oItem.getTitle();
                const sDesc = oItem.getDescription();
                const display = `${sDesc} (${sBsart})`;
                oView.byId("inpBsart").setValue(display);
                oView.byId("inpBsart").data("selectedKey", sBsart);
              }
            },
            items: {
              path: "/DocTypes",
              template: new sap.m.StandardListItem({
                title: "{Bsart}",
                description: "{Batxt}",
              }),
            },
          });
        }

        // 🔹 Load trực tiếp từ OData PRsSet rồi lọc unique Bsart
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];

            (data.results || []).forEach((row) => {
              const code = (row.Bsart || "").trim();
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({
                  Bsart: code,
                  Batxt: docTypeMap[code] || "Unknown Type",
                });
              }
            });

            // 🔸 Sort cho đẹp
            unique.sort((a, b) => a.Bsart.localeCompare(b.Bsart));

            const oLocalModel = new sap.ui.model.json.JSONModel({
              DocTypes: unique,
            });
            this._oBsartDialog.setModel(oLocalModel);
            this._oBsartDialog.open();
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("❌ Cannot load Document Type list.");
          },
        });
      },

      onValueHelpEkgrp: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        if (!this._oEkgrpDialog) {
          this._oEkgrpDialog = new sap.m.SelectDialog({
            title: "Select Purchasing Group",
            search: (e) => {
              const sVal = e.getParameter("value")?.trim().toUpperCase();
              e.getSource()
                .getBinding("items")
                .filter([
                  new sap.ui.model.Filter(
                    "Ekgrp",
                    sap.ui.model.FilterOperator.Contains,
                    sVal
                  ),
                ]);
            },
            confirm: (e) => {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sEkgrp = oItem.getTitle();
                const sDesc = oItem.getDescription();
                oView.byId("inpEkgrp").setValue(sDesc);
                oView.byId("inpEkgrp").data("selectedKey", sEkgrp);
              }
            },
            items: {
              path: "/PurchGroups",
              template: new sap.m.StandardListItem({
                title: "{Ekgrp}",
                description: "{Eknam}",
              }),
            },
          });
        }

        // 🔹 Load trực tiếp từ OData PRsSet rồi lọc unique EKGRP
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];

            (data.results || []).forEach((row) => {
              const code = (row.Ekgrp || "").trim();
              const name = (row.Eknam || "").trim();
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({
                  Ekgrp: code,
                  Eknam: name || code, // fallback hiển thị code nếu thiếu tên
                });
              }
            });

            // 🔸 Sort cho đẹp
            unique.sort((a, b) => a.Ekgrp.localeCompare(b.Ekgrp));

            const oLocalModel = new sap.ui.model.json.JSONModel({
              PurchGroups: unique,
            });
            this._oEkgrpDialog.setModel(oLocalModel);
            this._oEkgrpDialog.open();
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("❌ Cannot load Purchasing Group list.");
          },
        });
      },

      onValueHelpErnam: function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        if (!this._oErnamDialog) {
          this._oErnamDialog = new sap.m.SelectDialog({
            title: "Select Created By",
            search: (e) => {
              const sVal = e.getParameter("value")?.trim().toUpperCase();
              e.getSource()
                .getBinding("items")
                .filter([
                  new sap.ui.model.Filter(
                    "Ernam",
                    sap.ui.model.FilterOperator.Contains,
                    sVal
                  ),
                ]);
            },
            confirm: (e) => {
              const oItem = e.getParameter("selectedItem");
              if (oItem) {
                const sErnam = oItem.getTitle();
                oView.byId("inpErnam").setValue(sErnam);
                oView.byId("inpErnam").data("selectedKey", sErnam);
              }
            },
            items: {
              path: "/Users",
              template: new sap.m.StandardListItem({
                title: "{Ernam}",
              }),
            },
          });
        }

        // 🔹 Load trực tiếp từ OData PRsSet rồi lọc unique ERNAM
        sap.ui.core.BusyIndicator.show(0);
        oModel.read("/PRsSet", {
          urlParameters: { $top: 10000 },
          success: (data) => {
            sap.ui.core.BusyIndicator.hide();
            const seen = new Set();
            const unique = [];

            (data.results || []).forEach((row) => {
              const code = (row.Ernam || "").trim();
              if (code && !seen.has(code)) {
                seen.add(code);
                unique.push({ Ernam: code });
              }
            });

            // 🔸 Sort cho đẹp
            unique.sort((a, b) => a.Ernam.localeCompare(b.Ernam));

            const oLocalModel = new sap.ui.model.json.JSONModel({
              Users: unique,
            });
            this._oErnamDialog.setModel(oLocalModel);
            this._oErnamDialog.open();
          },
          error: () => {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("❌ Cannot load Created By list.");
          },
        });
      },

      onNavHome: function () {
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        if (oRouter) oRouter.navTo("DashBoard");
        else MessageToast.show("🔙 Back to Home");
      },
    });
  }
);
