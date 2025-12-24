sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/viz/ui5/data/FlattenedDataset",
  ],
  function (
    Controller,
    JSONModel,
    Fragment,
    BusyIndicator,
    MessageToast,
    FeedItem,
    FlattenedDataset
  ) {
    "use strict";

    return Controller.extend("demodashboard.controller.DashboardPR", {
      onInit: function () {
        this.oOData = this.getOwnerComponent().getModel(); // OData model
        this._hiddenPhases = {
          PR: false,
          PO: false,
          RFQ: false,
        };

        // ==================== PHÂN QUYỀN ROLE ====================
        const oRoleModel = this.getOwnerComponent().getModel("userRole");
        this._userRole = oRoleModel ? oRoleModel.getProperty("/role") : null;
        this._userId = oRoleModel ? oRoleModel.getProperty("/userid") : null;

        console.log(
          "🔑 User Role loaded in DashboardPR:",
          this._userRole,
          this._userId
        );

        // Nếu chưa có model (do async) -> chờ model load xong rồi áp dụng
        if (!this._userRole) {
          const oModelCheck = this.getOwnerComponent().getModel("userRole");
          if (oModelCheck) {
            oModelCheck.attachRequestCompleted(() => {
              this._userRole = oModelCheck.getProperty("/role");
              this._applyRoleVisibility();
            });
          }
        } else {
          this._applyRoleVisibility();
        }
        // =========================================================

        // 🔹 Tạo danh sách năm cho filter PR
        const currentYear = new Date().getFullYear();
        const aYears = [];
        for (let y = currentYear; y >= 2020; y--) {
          aYears.push({ key: y.toString(), text: `${y}` });
        }

        // 🔹 Tạo model lưu năm được chọn riêng cho PR
        const oViewModel = new JSONModel({
          years: aYears,
          selectedPRYear: currentYear.toString(), // mặc định là năm hiện tại
        });
        this.getView().setModel(oViewModel, "viewModel");

        // 🔹 Bind năm vào Select
        const oYearSelect = this.byId("prYearFilter");
        if (oYearSelect) {
          oYearSelect.bindItems({
            path: "viewModel>/years",
            template: new sap.ui.core.Item({
              key: "{viewModel>key}",
              text: "{viewModel>text}",
            }),
          });
        }

        this._reloadChartsOnly("thisYear");
        this._currentPoType = "F";
        this._currentRequesterSort = "totalPR";
      },

      // ================== RFQ helper (dùng chung cho Dashboard) ==================
      _getRFQSetFromEket: function () {
        // cache để không gọi EKET nhiều lần
        if (this._rfqFromEket) {
          return Promise.resolve(this._rfqFromEket);
        }

        return new Promise(
          function (resolve, reject) {
            this.oOData.read("/EKET001Set", {
              success: function (oData) {
                // lấy list Ebeln duy nhất
                const set = new Set();
                (oData.results || []).forEach(function (r) {
                  if (r.Ebeln) {
                    set.add(r.Ebeln);
                  }
                });

                this._rfqFromEket = set; // cache
                resolve(set);
              }.bind(this),
              error: function (e) {
                console.error("❌ EKET001Set read error:", e);
                // nếu lỗi thì trả set rỗng, để dashboard vẫn chạy được
                resolve(new Set());
              },
            });
          }.bind(this)
        );
      },

      _applyRoleVisibility: function () {
        const role = this._userRole;

        if (!role) {
          console.warn("⚠️ No role, show all default");
          return;
        }

        console.log("👔 Apply permissions to roles:", role);

        // 🔸 CEO có full quyền
        if (role === "BASIS") {
          // Không ẩn gì cả
          this.getView().byId("dashboard").setBusy(false);
          return;
        }

        // 🔸 Các role khác (sẽ bổ sung sau)
        if (role === "T") {
          // Ví dụ: chỉ ẩn bảng top requester
          this.byId("topRequesterSection").setVisible(false);
        } else if (role === "T" || role === "T") {
          // Ví dụ: chỉ cho xem một số chart
          this.byId("kpiContainer").setVisible(false);
          this.byId("topRequesterSection").setVisible(false);
        }
      },

      onTimeFilterChange: function (oEvent) {
        var sKey = oEvent.getSource().getSelectedKey();
        if (this._currentPeriod === sKey) return;
        this._reloadChartsOnly(sKey);
      },

      onRequesterSortChange: function (oEvent) {
        const sKey = oEvent.getSource().getSelectedKey(); // "totalPR" hoặc "approvalRate"
        this._currentRequesterSort = sKey;

        const oModel = this.getView().getModel("topRequesterModel");
        if (
          oModel &&
          oModel.getData() &&
          Array.isArray(oModel.getData().items)
        ) {
          let aItems = [...oModel.getData().items]; // ✅ copy tránh mutate trực tiếp model

          // 🔹 Logic sắp xếp chính xác và ổn định
          if (sKey === "approvalRate") {
            aItems.sort((a, b) => {
              const rateA = parseFloat(a.ApprovalRateNum || 0);
              const rateB = parseFloat(b.ApprovalRateNum || 0);
              if (rateB !== rateA) return rateB - rateA; // Ưu tiên tỉ lệ duyệt cao
              return b.TotalPR - a.TotalPR; // Nếu bằng nhau → theo tổng PR
            });
          } else {
            aItems.sort((a, b) => {
              if (b.TotalPR !== a.TotalPR) return b.TotalPR - a.TotalPR;
              const rateA = parseFloat(a.ApprovalRateNum || 0);
              const rateB = parseFloat(b.ApprovalRateNum || 0);
              return rateB - rateA; // Nếu tổng PR bằng nhau → theo % duyệt
            });
          }

          // 🔹 Cập nhật lại chỉ số STT
          aItems.forEach((item, idx) => {
            item.index = idx + 1;
          });

          // 🔹 Cập nhật model (và refresh để UI render lại)
          oModel.setData({ items: aItems });
          oModel.refresh(true);

          console.log(`📊 Sorted by: ${sKey}`, aItems);
        } else {
          // 🧩 Nếu model chưa có dữ liệu → tải lần đầu
          this._loadTopRequesterTable(sKey);
        }
      },

      onPRYearChange: function (oEvent) {
        const sSelectedYear = oEvent.getSource().getSelectedKey();
        console.log("📅 PR Year Selected:", sSelectedYear);

        // Lưu lại vào model
        const oViewModel = this.getView().getModel("viewModel");
        oViewModel.setProperty("/selectedPRYear", sSelectedYear);

        // 🔁 Reload lại biểu đồ PR theo năm đã chọn
        this._loadMonthlyPRBarChart("thisYear", sSelectedYear);
      },

      // ⬇️⬇️ THÊM Ở ĐÂY
      onPoTypeChange: function (oEvent) {
        const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
        this._currentPoType = sSelectedKey; // lưu lại trạng thái hiện tại (F = PO, A = RFQ)
        const sPeriodKey =
          this.byId("timeFilter").getSelectedKey() || "thisYear";

        this._loadMonthlyPoBarChart(sPeriodKey);
      },




      /* ===== Tải toàn bộ dashboard ===== */
      _reloadChartsOnly: function (sPeriodKey) {
        BusyIndicator.show(0);

        const oHBox = this.getView().byId("kpiContainer");
        if (oHBox) {
          oHBox.removeAllItems(); // Xóa toàn bộ thẻ KPI cũ
        }

        Promise.all([
          this._loadKpiPurchaseRequisition(sPeriodKey),
          this._loadKpiRFQ(sPeriodKey),
          this._loadKpiPO(sPeriodKey),
          this._loadStatusDonutChart(sPeriodKey),
          this._loadStatusDonutChartPO(sPeriodKey),
          this._loadTopMaterialBarChart(sPeriodKey),
          this._loadTopVendorBarChart(sPeriodKey),
          this._loadTopRequesterTable(sPeriodKey),
          this._loadMonthlyPRBarChart(sPeriodKey),
          this._loadMonthlyPoBarChart(sPeriodKey),
          this._loadConnectedScatterChart(sPeriodKey),
        ]).finally(() => {
          BusyIndicator.hide(); // ✅ Thêm dòng này để đóng BusyIndicator
        });
      },

      /* ===== Load KPI ===== */
      _loadKpiPurchaseRequisition: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);
        const oPrevRange = this._getPreviousRange(sPeriodKey);

        this.oOData.read("/PRSet", {
          urlParameters: {
            $select: "Banfn,Badat",
            $top: "500",
          },
          success: function (oData) {
            BusyIndicator.hide();

            const aResults = oData.results || [];
            if (aResults.length === 0) {
              MessageToast.show("No Purchase Requisition data available");
              this._displayKpiCardGeneric("PR", sPeriodKey, 0, 0);
              return;
            }

            // 🔹 Parse BADAT từ định dạng /Date(...)/ sang Date object
            aResults.forEach(function (r) {
              if (typeof r.Badat === "string") {
                const match = /Date\((\d+)\)/.exec(r.Badat);
                if (match) r.Badat = new Date(parseInt(match[1], 10));
              }
            });

            // 🔹 Lọc dữ liệu theo khoảng thời gian
            const aCurr = aResults.filter(
              (r) => r.Badat >= oCurrRange.start && r.Badat <= oCurrRange.end
            );
            const aPrev = aResults.filter(
              (r) => r.Badat >= oPrevRange.start && r.Badat <= oPrevRange.end
            );

            // 🔹 Đếm PR duy nhất
            const iCurrCount = this._countUniqueBanfn(aCurr);
            const iPrevCount = this._countUniqueBanfn(aPrev);

            // 🔹 Hiển thị KPI Card cho PR
            this._displayKpiCardGeneric(
              "PR",
              sPeriodKey,
              iCurrCount,
              iPrevCount
            );
          }.bind(this),

          error: function (e) {
            BusyIndicator.hide();
            console.error("❌ OData Read error:", e);
            MessageToast.show("Error loading KPI Purchase Requisition data");
            this._displayKpiCardGeneric("PR", sPeriodKey, 0, 0);
          }.bind(this),
        });
      },

      /* ===== Load KPI cho RFQ (chuẩn logic RFQList) ===== */
      _loadKpiRFQ: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);
        const oPrevRange = this._getPreviousRange(sPeriodKey);

        // 1. Lấy danh sách RFQ EBELN từ EKET (chuẩn SAP GUI)
        const pEket = new Promise((resolve) => {
          this.oOData.read("/EKET001Set", {
            success: (d) => {
              const set = new Set();
              (d.results || []).forEach((r) => {
                if (r.Ebeln) set.add(r.Ebeln);
              });
              resolve(set);
            },
            error: () => resolve(new Set()),
          });
        });

        // 2. Lấy tất cả header từ ProcurementHeaderSet
        const pHeader = new Promise((resolve, reject) => {
          this.oOData.read("/ProcurementHeaderSet", {
            urlParameters: { $select: "Ebeln,Aedat,Bstyp", $top: "10000" },
            success: resolve,
            error: reject,
          });
        });

        Promise.all([pEket, pHeader])
          .then(([eketSet, headerData]) => {
            BusyIndicator.hide();

            // 3. RFQ hợp lệ = những EBELN tồn tại trong EKET
            let aRFQ = headerData.results.filter(
              (h) => h.Bstyp === "A" && eketSet.has(h.Ebeln)
            );

            // 4. Chuẩn hóa ngày
            aRFQ.forEach((r) => {
              if (typeof r.Aedat === "string") {
                const m = /Date\((\d+)\)/.exec(r.Aedat);
                if (m) r.Aedat = new Date(parseInt(m[1], 10));
              }
            });

            // 5. RFQ của kỳ hiện tại + kỳ trước
            const curr = aRFQ.filter(
              (r) => r.Aedat >= oCurrRange.start && r.Aedat <= oCurrRange.end
            );
            const prev = aRFQ.filter(
              (r) => r.Aedat >= oPrevRange.start && r.Aedat <= oPrevRange.end
            );

            const currCount = new Set(curr.map((r) => r.Ebeln)).size;
            const prevCount = new Set(prev.map((r) => r.Ebeln)).size;

            this._displayKpiCardGeneric(
              "RFQ",
              sPeriodKey,
              currCount,
              prevCount
            );
          })
          .catch(() => {
            BusyIndicator.hide();
            this._displayKpiCardGeneric("RFQ", sPeriodKey, 0, 0);
          });
      },

      /* ===== Load KPI cho PO ===== */
      _loadKpiPO: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);
        const oPrevRange = this._getPreviousRange(sPeriodKey);

        // 🔥 STEP 1: Lấy danh sách PO hợp lệ từ EKET001Set
        const pEket = new Promise((resolve) => {
          this.oOData.read("/EKET001Set", {
            success: (d) => {
              const set = new Set();
              (d.results || []).forEach((r) => {
                if (r.Ebeln) set.add(r.Ebeln);
              });
              resolve(set);
            },
            error: () => resolve(new Set()),
          });
        });

        // 🔥 STEP 2: Lấy tất cả header
        const pHeader = new Promise((resolve, reject) => {
          this.oOData.read("/ProcurementHeaderSet", {
            urlParameters: { $select: "Ebeln,Aedat,Bstyp", $top: "10000" },
            success: resolve,
            error: reject,
          });
        });

        Promise.all([pEket, pHeader])
          .then(([eketSet, headerData]) => {
            BusyIndicator.hide();

            // 🔥 STEP 3: Chỉ lấy PO có trong EKET (Bstyp = "F")
            let aPO = headerData.results.filter(
              (h) => h.Bstyp === "F" && eketSet.has(h.Ebeln)
            );

            if (aPO.length === 0) {
              this._displayKpiCardGeneric("PO", sPeriodKey, 0, 0);
              return;
            }

            // Parse ngày
            aPO.forEach((r) => {
              if (typeof r.Aedat === "string") {
                const m = /Date\((\d+)\)/.exec(r.Aedat);
                if (m) r.Aedat = new Date(parseInt(m[1], 10));
              }
            });

            // Lọc theo thời gian
            const curr = aPO.filter(
              (r) => r.Aedat >= oCurrRange.start && r.Aedat <= oCurrRange.end
            );
            const prev = aPO.filter(
              (r) => r.Aedat >= oPrevRange.start && r.Aedat <= oPrevRange.end
            );

            const currCount = new Set(curr.map((r) => r.Ebeln)).size;
            const prevCount = new Set(prev.map((r) => r.Ebeln)).size;

            this._displayKpiCardGeneric("PO", sPeriodKey, currCount, prevCount);
          })
          .catch(() => {
            BusyIndicator.hide();
            this._displayKpiCardGeneric("PO", sPeriodKey, 0, 0);
          });
      },

      
      // ====== Load Status Donut Chart (PR) - FIX CHUẨN NHẤT ======
      _loadStatusDonutChart: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);

        this.oOData.read("/PRSet", {
          urlParameters: {
            $select: "Banfn,Badat,Frgkz,REASON_ID",
            $top: "5000",
          },

          success: function (oData) {
            BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
              this._displayStatusDonutChart([
                { Status: "Approved", Count: 0 },
                { Status: "Pending", Count: 0 },
                { Status: "Rejected", Count: 0 },
              ]);
              return;
            }

            // --- Parse date BADAT ---
            oData.results.forEach(function (r) {
              if (typeof r.Badat === "string") {
                const m = /Date\((\d+)\)/.exec(r.Badat);
                if (m) r.Badat = new Date(parseInt(m[1], 10));
              }
            });

            // --- Lọc theo khoảng thời gian ---
            const aCurr = oData.results.filter(
              (r) =>
                r.Badat &&
                r.Badat >= oCurrRange.start &&
                r.Badat <= oCurrRange.end
            );

            // =====================================================
            //   ⭐⭐ 1. GROUP THEO BANFN (PR HEADER) NHƯ PRLIST ⭐⭐
            // =====================================================
            const mGroup = {};

            aCurr.forEach(function (r) {
              const key = r.Banfn;

              if (!mGroup[key]) {
                mGroup[key] = { Banfn: r.Banfn, Items: [] };
              }

              mGroup[key].Items.push({
                Frgkz: r.Frgkz,
                ReasonId: r.REASON_ID || "",
              });
            });

            // =====================================================
            //   ⭐⭐ 2. TÍNH STATUS CHO TỪNG PR (HEADER) ⭐⭐
            // =====================================================
           let iReleased = 0,
              iProcessing = 0,
              iProcessingReason = 0;

          Object.values(mGroup).forEach(function (g) {
            const aItems = g.Items;

            const hasReleased = aItems.some(it => it.Frgkz === "R");
            const hasRejectedWithReason = aItems.some(
              it => it.Frgkz === "C" && it.ReasonId
            );

            if (hasReleased) {
              iReleased++;
            } else if (hasRejectedWithReason) {
              iProcessingReason++;
            } else {
              iProcessing++;
            }
          });


            // =====================================================
            //   ⭐⭐ 3. DATA CHO DONUT CHART ⭐⭐
            // =====================================================
            let aChartData = [
              { Status: "Released", Count: iReleased },
              { Status: "Processing", Count: iProcessing },
              { Status: "Processing (Reason ID)", Count: iProcessingReason }
            ].filter(item => item.Count > 0);

            if (aChartData.length === 0) {
              aChartData = [{ Status: "No Data", Count: 1 }];
            }


            // Render Donut Chart
            this._displayStatusDonutChart(aChartData);
          }.bind(this),

          error: function () {
            BusyIndicator.hide();
            this._displayStatusDonutChart([{ Status: "No Data", Count: 1 }]);
          }.bind(this),
        });
      },

      _loadStatusDonutChartPO: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);

        this.oOData.read("/ProcurementHeaderSet", {
          urlParameters: {
            $select: "Ebeln,Aedat,Frgke,Bstyp",
            $top: "5000",
          },
          success: function (oData) {
            BusyIndicator.hide();

            // 🔹 Lọc chỉ lấy PO (Bstyp === "F")
            const aResults = oData.results.filter((r) => r.Bstyp === "F");
            if (aResults.length === 0) {
              this._displayStatusDonutChartPO([
                { Status: "Approved", Count: 0 },
                { Status: "Pending", Count: 0 },
                { Status: "Rejected", Count: 0 },
              ]);
              return;
            }

            // 🔹 Parse ngày Aedat
            aResults.forEach((r) => {
              if (r.Aedat && typeof r.Aedat === "string") {
                const match = /Date\((\d+)\)/.exec(r.Aedat);
                if (match) r.Aedat = new Date(parseInt(match[1], 10));
              }
            });

            // 🔹 Lọc trong khoảng thời gian
            const aCurr = aResults.filter(
              (r) => r.Aedat >= oCurrRange.start && r.Aedat <= oCurrRange.end
            );

            // 🔹 Đếm trạng thái (Frgkz)
            let iApproved = 0,
              iPending = 0,
              iRejected = 0;
            aCurr.forEach((r) => {
              if (r.Frgke === "R") iApproved++;
              else if (r.Frgke === "C") iPending++;
              else if (r.Frgke === "A") iRejected++;
            });

            const aChartData = [
              { Status: "Approved", Count: iApproved },
              { Status: "Pending", Count: iPending },
              { Status: "Rejected", Count: iRejected },
            ].filter((i) => i.Count > 0);

            this._displayStatusDonutChartPO(aChartData);
          }.bind(this),

          error: function (e) {
            BusyIndicator.hide();
            console.error("❌ Error loading PO Status Donut:", e);
            MessageToast.show("Failed to load PO status data");
            this._displayStatusDonutChartPO([{ Status: "No Data", Count: 1 }]);
          }.bind(this),
        });
      },

      /* ===== Load Bar Chart: Top Material ===== */
      _loadTopMaterialBarChart: function (sPeriodKey) {
        BusyIndicator.show(0);
        var oCurrRange = this._getDateRange(sPeriodKey);

        this.oOData.read("/PRSet", {
          urlParameters: {
            $select: "Banfn,Badat,Txz01",
            $top: "5000",
          },
          success: function (oData) {
            BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
              MessageToast.show("No material data available");
              this._displayTopMaterialBarChart([]);
              return;
            }

            // Parse ngày
            oData.results.forEach(function (r) {
              if (r.Badat && typeof r.Badat === "string") {
                var match = /Date\\((\\d+)\\)/.exec(r.Badat);
                if (match) r.Badat = new Date(parseInt(match[1], 10));
              }
            });

            // Lọc theo thời gian
            var aCurr = oData.results.filter(function (r) {
              return (
                r.Badat &&
                r.Badat >= oCurrRange.start &&
                r.Badat <= oCurrRange.end
              );
            });

            // Nhóm theo Txz01
            var oCountMap = {};
            aCurr.forEach(function (r) {
              var key = r.Txz01 ||"Unknown";
              oCountMap[key] = (oCountMap[key] || 0) + 1;
            });

            // Tạo mảng dữ liệu
            var aChartData = Object.keys(oCountMap).map(function (key) {
              return { Material: key, Count: oCountMap[key] };
            });

            // Sắp xếp và lấy Top 5
            aChartData.sort((a, b) => b.Count - a.Count);
            aChartData = aChartData.slice(0, 5);

            this._displayTopMaterialBarChart(aChartData);
          }.bind(this),

          error: function (e) {
            BusyIndicator.hide();
            MessageToast.show("Error loading material data");
            this._displayTopMaterialBarChart([]);
          }.bind(this),
        });
      },

      _loadTopVendorBarChart: function (sPeriodKey) {
        BusyIndicator.show(0);
        const oCurrRange = this._getDateRange(sPeriodKey);

        // 🔹 Gọi VendorsSet trước
        this.oOData.read("/VendorsSet", {
          success: function (oVendorData) {
            const oVendorMap = {};
            oVendorData.results.forEach((v) => {
              oVendorMap[v.Lifnr] = v.Name1;
            });

            // 🔹 Gọi PRSet sau khi đã có map vendor
            this.oOData.read("/PRSet", {
              urlParameters: {
                $select: "Banfn,Badat,Lifnr",
                $top: "5000",
              },
              success: function (oPRData) {
                BusyIndicator.hide();

                const aResults = oPRData.results || [];

                // Parse ngày
                aResults.forEach((r) => {
                  if (typeof r.Badat === "string") {
                    const match = /Date\((\d+)\)/.exec(r.Badat);
                    if (match) r.Badat = new Date(parseInt(match[1], 10));
                  }
                });

                // Lọc theo khoảng thời gian
                const aCurr = aResults.filter(
                  (r) =>
                    r.Badat &&
                    r.Badat >= oCurrRange.start &&
                    r.Badat <= oCurrRange.end
                );

                // Nhóm theo vendor (Lifnr)
                const oCountMap = {};
                aCurr.forEach((r) => {
                  const key = r.Lifnr || "UNKNOWN";
                  oCountMap[key] = (oCountMap[key] || 0) + 1;
                });

                // Tạo dữ liệu biểu đồ (dùng tên nếu có)
                let aChartData = Object.keys(oCountMap).map((key) => {
                  return {
                    Vendor: oVendorMap[key] || key, // Ưu tiên tên, fallback mã
                    Count: oCountMap[key],
                  };
                });

                // Sắp xếp và lấy Top 5
                aChartData.sort((a, b) => b.Count - a.Count);
                aChartData = aChartData.slice(0, 5);

                this._displayTopVendorBarChart(aChartData);
              }.bind(this),

              error: function (e) {
                BusyIndicator.hide();
                MessageToast.show("Error reading PRSet");
              }.bind(this),
            });
          }.bind(this),
          error: function (e) {
            BusyIndicator.hide();
            MessageToast.show("Error reading VendorsSet");
          }.bind(this),
        });
      },

      _loadMonthlyPRBarChart: function (sPeriodKey, sSelectedYear) {
        return new Promise((resolve, reject) => {
          BusyIndicator.show(0);

          this.oOData.read("/PRSet", {
            urlParameters: { $select: "Banfn,Badat", $top: "2000" },
            success: (oData) => {
              BusyIndicator.hide();
              const aResults = oData.results || [];

              if (aResults.length === 0) {
                this._displayMonthlyPRBarChart([]);
                return resolve();
              }

              // Parse ngày
              aResults.forEach((r) => {
                if (typeof r.Badat === "string") {
                  const match = /Date\((\d+)\)/.exec(r.Badat);
                  if (match) r.Badat = new Date(parseInt(match[1], 10));
                }
              });

              const range = this._getDateRange(sPeriodKey);
              const uniqueSet = new Set();

              if (sPeriodKey === "thisAll") {
                const yearCountMap = {};

                aResults.forEach((r) => {
                  if (
                    r.Badat instanceof Date &&
                    r.Badat >= range.start &&
                    r.Badat <= range.end
                  ) {
                    const year = r.Badat.getFullYear();
                    const key = `${r.Banfn}-${year}`;
                    if (!uniqueSet.has(key)) {
                      uniqueSet.add(key);
                      yearCountMap[year] = (yearCountMap[year] || 0) + 1;
                    }
                  }
                });

                const minYear = Math.min(
                  ...aResults.map((r) => r.Badat.getFullYear())
                );
                const maxYear = new Date().getFullYear();

                const aChartData = [];
                for (let year = minYear; year <= maxYear; year++) {
                  aChartData.push({
                    Month: `${year}`,
                    Count: yearCountMap[year] || 0,
                  });
                }

                this._displayMonthlyPRBarChart(aChartData);
                resolve();
              } else {
                const year = sSelectedYear
                  ? parseInt(sSelectedYear, 10)
                  : range.start.getFullYear();
                const monthlyCount = Array(12).fill(0);

                aResults.forEach((r) => {
                  if (
                    r.Badat instanceof Date &&
                    r.Badat.getFullYear() === year
                  ) {
                    const month = r.Badat.getMonth();
                    const key = `${r.Banfn}-${month}`;
                    if (!uniqueSet.has(key)) {
                      uniqueSet.add(key);
                      monthlyCount[month]++;
                    }
                  }
                });

                const aChartData = monthlyCount.map((count, i) => ({
                  Month: `Month ${i + 1}`,
                  Count: count,
                }));

                this._displayMonthlyPRBarChart(aChartData);
                resolve();
              }

              // ❌ XÓA ĐOẠN NÀY - BỊ DUPLICATE
              // const aChartData = monthlyCount.map((count, i) => ({
              //   Month: `Tháng ${i + 1}`,
              //   Count: count,
              // }));
              // this._displayMonthlyPRBarChart(aChartData);
              // resolve();
            },

            error: (e) => {
              BusyIndicator.hide();
              console.error("❌ Error loading Monthly PR:", e);
              this._displayMonthlyPRBarChart([]);
              reject(e);
            },
          });
        });
      },

      _loadTopRequesterTable: function () {
        BusyIndicator.show(0);

        this.oOData.read("/PRSet", {
          urlParameters: {
            $select: "Banfn,Ernam,Badat,Frgkz",
            $top: "2000",
          },
          success: (oData) => {
            BusyIndicator.hide();
            const aResults = oData.results || [];

            // Normalize dates
            aResults.forEach((r) => {
              ["Badat", "Frgdt"].forEach((field) => {
                if (typeof r[field] === "string") {
                  const m = /Date\((\d+)\)/.exec(r[field]);
                  if (m) r[field] = new Date(parseInt(m[1], 10));
                }
              });
            });

            // Group by Ernam (user)
            const oUserMap = {};
            aResults.forEach((r) => {
              const user = r.Ernam || "UNKNOWN";
              if (!oUserMap[user]) {
                oUserMap[user] = {
                  UserID: user,
                  FullName: user, // fallback; you can replace with lookup later
                  TotalPR: 0,
                  ApprovedPR: 0,
                  PendingPR: 0,
                  ApprovalDays: [],
                  Dates: [],
                };
              }

              oUserMap[user].TotalPR++;
              if (r.Badat) oUserMap[user].Dates.push(r.Badat);

              // Count statuses
              if (r.Frgkz === "R") {
                // Approved (your mapping)
                oUserMap[user].ApprovedPR++;
                // If release date available - calculate approval days
                if (r.Badat && r.Frgdt) {
                  const diffDays = Math.max(
                    0,
                    Math.round((r.Frgdt - r.Badat) / (1000 * 60 * 60 * 24))
                  );
                  oUserMap[user].ApprovalDays.push(diffDays);
                }
              } else if (r.Frgkz === "C") {
                // Pending
                oUserMap[user].PendingPR++;
              }
            });

            // Build array without index yet
            const aUsers = Object.values(oUserMap).map((u) => {
              const approvalRateNum =
                u.TotalPR > 0 ? (u.ApprovedPR / u.TotalPR) * 100 : 0;
              const approvalRate =
                u.TotalPR > 0 ? approvalRateNum.toFixed(1) + "%" : "0%";
              const avgDays =
                u.ApprovalDays.length > 0
                  ? (
                      u.ApprovalDays.reduce((a, b) => a + b, 0) /
                      u.ApprovalDays.length
                    ).toFixed(1)
                  : null; // null means '-' in UI

              const lastDate =
                u.Dates.length > 0
                  ? new Date(Math.max(...u.Dates)).toLocaleDateString()
                  : "-";

              return {
                UserID: u.UserID,
                TotalPR: u.TotalPR,
                ApprovedPR: u.ApprovedPR,
                ApprovalRate: approvalRate,
                ApprovalRateNum: approvalRateNum,
                PendingPR: u.PendingPR,
                AvgApprovalDays: avgDays,
                LastCreatedDate: lastDate,
              };
            });

            // Decide sort key: read the current filter control (default to TotalPR)
            let sKey = "totalPR";
            const oSelect = this.byId("requesterSortFilter");
            if (oSelect) {
              sKey = oSelect.getSelectedKey() || "totalPR";
            }

            if (sKey === "approvalRate") {
              aUsers.sort((a, b) => {
                // sort by numeric approval rate desc, then totalPR desc
                if (b.ApprovalRateNum !== a.ApprovalRateNum)
                  return b.ApprovalRateNum - a.ApprovalRateNum;
                return b.TotalPR - a.TotalPR;
              });
            } else {
              // default sort by TotalPR desc, then approval rate desc
              aUsers.sort((a, b) => {
                if (b.TotalPR !== a.TotalPR) return b.TotalPR - a.TotalPR;
                return b.ApprovalRateNum - a.ApprovalRateNum;
              });
            }

            // Assign index (STT) after sorting and slice top N if needed
            const aTop = aUsers.slice(0, 40).map((item, idx) => {
              return Object.assign({}, item, {
                index: idx + 1,
                // format fields for display
                ApprovalRate: item.ApprovalRate,
                AvgApprovalDaysDisplay:
                  item.AvgApprovalDays !== null
                    ? item.AvgApprovalDays + " days"
                    : "- days",
              });
            });

            const oModel = new sap.ui.model.json.JSONModel({ items: aTop });
            this.getView().setModel(oModel, "topRequesterModel");
          },

          error: (e) => {
            BusyIndicator.hide();
            console.error("❌ Error loading Top Requesters data:", e);
            MessageToast.show("Error loading Top Requesters data");
          },
        });
      },

      /* ===== Load Monthly Chart cho RFQ hoặc PO ===== */
      _loadMonthlyPoBarChart: function (sPeriodKey) {
        const sDocType = this._currentPoType; // "F" = PO, "A" = RFQ

        if (sDocType === "A") {
          // 🔵 RFQ Chart
          return this._loadMonthlyRFQChart(sPeriodKey);
        } else {
          // 🟢 PO Chart
          return this._loadMonthlyPOChart(sPeriodKey);
        }
      },

      _loadMonthlyRFQChart: function (sPeriodKey) {
        return new Promise((resolve) => {
          BusyIndicator.show(0);
          const range = this._getDateRange(sPeriodKey);
          const year = range.start.getFullYear();

          // 🔥 STEP 1: Lấy danh sách RFQ hợp lệ từ EKET001Set
          const pEket = new Promise((res) => {
            this.oOData.read("/EKET001Set", {
              success: (d) => {
                const set = new Set();
                (d.results || []).forEach((r) => {
                  if (r.Ebeln) set.add(r.Ebeln);
                });
                console.log("✅ EKET loaded:", set.size, "unique Ebeln");
                res(set);
              },
              error: (err) => {
                console.error("❌ Error loading EKET:", err);
                res(new Set());
              },
            });
          });

          // 🔥 STEP 2: Lấy tất cả header từ ProcurementHeaderSet
          const pHeader = new Promise((res, rej) => {
            this.oOData.read("/ProcurementHeaderSet", {
              urlParameters: {
                $select: "Ebeln,Aedat,Bstyp",
                $top: "10000",
              },
              success: res,
              error: rej,
            });
          });

          Promise.all([pEket, pHeader])
            .then(([eketSet, headerData]) => {
              BusyIndicator.hide();

              // 🔥 STEP 3: Lọc chỉ lấy RFQ có trong EKET (Bstyp = "A")
              let aRFQ = headerData.results.filter(
                (h) => h.Bstyp === "A" && eketSet.has(h.Ebeln)
              );

              console.log("📊 Total RFQ after EKET filter:", aRFQ.length);

              if (aRFQ.length === 0) {
                console.warn("⚠️ No RFQ found in EKET");
                this._displayMonthlyPOBarChart([]);
                return resolve();
              }

              // 🔥 STEP 4: Parse ngày Aedat
              aRFQ.forEach((r) => {
                if (typeof r.Aedat === "string") {
                  const m = /Date\((\d+)\)/.exec(r.Aedat);
                  if (m) r.Aedat = new Date(parseInt(m[1], 10));
                }
              });

              // 🔥 STEP 5: Đếm RFQ theo tháng (loại bỏ trùng lặp)
              const monthly = Array(12).fill(0);
              const uniqueKeys = new Set();

              aRFQ.forEach((r) => {
                if (r.Aedat instanceof Date && r.Aedat.getFullYear() === year) {
                  const month = r.Aedat.getMonth(); // 0-11
                  const key = `${r.Ebeln}-${month}`;

                  if (!uniqueKeys.has(key)) {
                    uniqueKeys.add(key);
                    monthly[month]++;
                  }
                }
              });

              if (sPeriodKey === "thisAll") {
                const yearCountMap = {};
                const uniqueSet = new Set();

                aRFQ.forEach((r) => {
                  if (r.Aedat instanceof Date) {
                    const y = r.Aedat.getFullYear();
                    const key = `${r.Ebeln}-${y}`;

                    if (!uniqueSet.has(key)) {
                      uniqueSet.add(key);
                      yearCountMap[y] = (yearCountMap[y] || 0) + 1;
                    }
                  }
                });

                const minYear = Math.min(...Object.keys(yearCountMap).map(Number));
                const maxYear = new Date().getFullYear();

                const aChartData = [];
                for (let y = minYear; y <= maxYear; y++) {
                  aChartData.push({
                    Month: `${y}`,   // dùng chung field Month
                    Count: yearCountMap[y] || 0
                  });
                }

                this._displayMonthlyPOBarChart(aChartData);
                return resolve();
              }


              console.log("📈 Monthly RFQ counts:", monthly);
              
              // 🔥 STEP 6: Tạo dữ liệu chart
              const aChartData = monthly.map((count, i) => ({
                Month: `Month ${i + 1}`,
                Count: count,
              }));

              this._displayMonthlyPOBarChart(aChartData);
              resolve();
            })
            .catch((err) => {
              BusyIndicator.hide();
              console.error("❌ Error loading RFQ chart:", err);
              this._displayMonthlyPOBarChart([]);
              resolve();
            });
        });
      },

      _loadMonthlyPOChart: function (sPeriodKey) {
        return new Promise((resolve) => {
          BusyIndicator.show(0);
          const range = this._getDateRange(sPeriodKey);
          const year = range.start.getFullYear();

          // 🔥 STEP 1: Lấy danh sách PO hợp lệ từ EKET001Set
          const pEket = new Promise((res) => {
            this.oOData.read("/EKET001Set", {
              success: (d) => {
                const set = new Set();
                (d.results || []).forEach((r) => {
                  if (r.Ebeln) set.add(r.Ebeln);
                });
                console.log("✅ EKET loaded:", set.size, "unique Ebeln");
                res(set);
              },
              error: (err) => {
                console.error("❌ Error loading EKET:", err);
                res(new Set());
              },
            });
          });

          // 🔥 STEP 2: Lấy tất cả header
          const pHeader = new Promise((res, rej) => {
            this.oOData.read("/ProcurementHeaderSet", {
              urlParameters: {
                $select: "Ebeln,Aedat,Bstyp",
                $top: "10000",
              },
              success: res,
              error: rej,
            });
          });

          Promise.all([pEket, pHeader])
            .then(([eketSet, headerData]) => {
              BusyIndicator.hide();

              // 🔥 STEP 3: Lọc chỉ lấy PO có trong EKET (Bstyp = "F")
              let aPO = headerData.results.filter(
                (h) => h.Bstyp === "F" && eketSet.has(h.Ebeln)
              );

              console.log("📊 Total PO after EKET filter:", aPO.length);

              if (aPO.length === 0) {
                console.warn("⚠️ No PO found in EKET");
                this._displayMonthlyPOBarChart([]);
                return resolve();
              }

              // 🔥 STEP 4: Parse ngày
              aPO.forEach((r) => {
                if (typeof r.Aedat === "string") {
                  const m = /Date\((\d+)\)/.exec(r.Aedat);
                  if (m) r.Aedat = new Date(parseInt(m[1], 10));
                }
              });

              // 🔥 STEP 5: Đếm PO theo tháng (loại bỏ trùng lặp)
              const monthly = Array(12).fill(0);
              const uniqueKeys = new Set();

              aPO.forEach((r) => {
                if (r.Aedat instanceof Date && r.Aedat.getFullYear() === year) {
                  const month = r.Aedat.getMonth();
                  const key = `${r.Ebeln}-${month}`;

                  if (!uniqueKeys.has(key)) {
                    uniqueKeys.add(key);
                    monthly[month]++;
                  }
                }
              });

              if (sPeriodKey === "thisAll") {
                  const yearCountMap = {};
                  const uniqueSet = new Set();

                  aPO.forEach((r) => {
                    if (r.Aedat instanceof Date) {
                      const y = r.Aedat.getFullYear();
                      const key = `${r.Ebeln}-${y}`;

                      if (!uniqueSet.has(key)) {
                        uniqueSet.add(key);
                        yearCountMap[y] = (yearCountMap[y] || 0) + 1;
                      }
                    }
                  });

                  const minYear = Math.min(...Object.keys(yearCountMap).map(Number));
                  const maxYear = new Date().getFullYear();

                  const aChartData = [];
                  for (let y = minYear; y <= maxYear; y++) {
                    aChartData.push({
                      Month: `${y}`,   // dùng chung field Month
                      Count: yearCountMap[y] || 0
                    });
                  }

                  this._displayMonthlyPOBarChart(aChartData);
                  return resolve();
                }


              console.log("📈 Monthly PO counts:", monthly);

              // 🔥 STEP 6: Tạo dữ liệu chart
              const aChartData = monthly.map((count, i) => ({
                Month: `Month ${i + 1}`,
                Count: count,
              }));

              this._displayMonthlyPOBarChart(aChartData);
              resolve();
            })
            .catch((err) => {
              BusyIndicator.hide();
              console.error("❌ Error loading PO chart:", err);
              this._displayMonthlyPOBarChart([]);
              resolve();
            });
        });
      },

      /* ===== Load Connected Scatter Chart (Ổn định, không thay đổi dữ liệu lịch sử) ===== */
     _loadConnectedScatterChart: function () {
            sap.ui.core.BusyIndicator.show(0);

            const oModel = this.oOData;

            /* =======================================================
            * 1. LOAD DATA SONG SONG
            * ======================================================= */
            const pEKET = new Promise((resolve) => {
              oModel.read("/EKET001Set", {
                success: (d) => resolve(d.results || []),
                error: () => resolve([]),
              });
            });

            const pPR = new Promise((resolve) => {
              oModel.read("/PRSet", {
                urlParameters: {
                  $select: "Banfn,Bnfpo,Preis,Peinh,Menge,Badat",
                  $top: "5000",
                },
                success: (d) => resolve(d.results || []),
                error: () => resolve([]),
              });
            });

            const pItems = new Promise((resolve) => {
              oModel.read("/ProcurementItemSet", {
                urlParameters: {
                  $select: "Ebeln,Ebelp,Netpr,Peinh,Menge,Aedat",
                  $top: "5000",
                },
                success: (d) => resolve(d.results || []),
                error: () => resolve([]),
              });
            });

            const pHeaders = new Promise((resolve) => {
              oModel.read("/ProcurementHeaderSet", {
                urlParameters: {
                  $select: "Ebeln,Bstyp",
                  $top: "5000",
                },
                success: (d) => resolve(d.results || []),
                error: () => resolve([]),
              });
            });

            /* =======================================================
            * 2. PROCESS DATA
            * ======================================================= */
            Promise.all([pEKET, pPR, pItems, pHeaders])
              .then(([aEKET, aPRs, aItems, aHeaders]) => {
                sap.ui.core.BusyIndicator.hide();

                /* ---------- MAP HEADER ---------- */
                const mHeader = {};
                aHeaders.forEach((h) => {
                  mHeader[h.Ebeln] = h.Bstyp;
                });

                /* ---------- MAP EKET QUANTITY ---------- */
                const mEketQty = {}; // key = EBELN_EBELP
                const setEketEbeln = new Set();

                aEKET.forEach((e) => {
                  if (!e.Ebeln || !e.Ebelp) return;
                  const key = `${e.Ebeln}_${e.Ebelp}`;
                  mEketQty[key] = (mEketQty[key] || 0) + Number(e.Menge || 0);
                  setEketEbeln.add(e.Ebeln);
                });

                /* ---------- AGGREGATION ---------- */
                const mAgg = {
                  PR: {},
                  PO: {},
                  RFQ: {},
                };

                /* ===================================================
                * PR
                * =================================================== */
                aPRs.forEach((pr) => {
                  const d = this._parseDate(pr.Badat);
                  if (!d) return;

                  const month = `${d.getFullYear()}-${(
                    "0" + (d.getMonth() + 1)
                  ).slice(-2)}`;

                  const val =
                    (((Number(pr.Preis) || 0) * (Number(pr.Menge) || 0)) /
                    100) ;

                  mAgg.PR[month] = (mAgg.PR[month] || 0) + val;
                });

                /* ===================================================
                * PO + RFQ
                * =================================================== */
                aItems.forEach((it) => {
                  // 🔥 chỉ lấy những chứng từ có EKET
                  if (!setEketEbeln.has(it.Ebeln)) return;

                  const bstyp = mHeader[it.Ebeln];
                  if (!bstyp) return;

                  const d = this._parseDate(it.Aedat);
                  if (!d) return;

                  const month = `${d.getFullYear()}-${(
                    "0" + (d.getMonth() + 1)
                  ).slice(-2)}`;

                  let qty = 0;

                  if (bstyp === "F") {
                    // PO → lấy từ EKPO
                    qty = Number(it.Menge || 0);
                  } else {
                    return;
                  }

                  const val =
                    (((Number(it.Netpr) || 0) * qty) /
                    (Number(it.Peinh) || 1));

                  const phase = bstyp === "F" ? "PO" : "RFQ";
                  mAgg[phase][month] = (mAgg[phase][month] || 0) + val;
                });

                /* ===================================================
                * 3. MERGE DATA FOR CHART
                * =================================================== */
                const aChartData = [];

                ["PR", "PO", "RFQ"].forEach((phase) => {
                  Object.entries(mAgg[phase]).forEach(([month, val]) => {
                    aChartData.push({
                      Phase: phase,
                      Date: month,
                      Amount: val,
                    });
                  });
                });

                aChartData.sort((a, b) => a.Date.localeCompare(b.Date));

                this._displayConnectedScatterChart(aChartData);
              })
              .catch((e) => {
                sap.ui.core.BusyIndicator.hide();
                console.error("❌ Load Connected Chart Error:", e);
              });
          },


      /* ===== Hiển thị KPI Card ===== */
      _displayKpiCard: function (sPeriodKey, iCurrCount, iPrevCount) {
        const fPercent =
          iPrevCount === 0
            ? iCurrCount > 0
              ? 100
              : 0
            : ((iCurrCount - iPrevCount) / iPrevCount) * 100;

        const oKpi = {
          title: "Purchase Requisition",
          period: this._getPeriodLabel(sPeriodKey),
          value: iCurrCount.toLocaleString(),
          percentage: (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%",
          progress: Math.min(Math.abs(Math.round(fPercent)), 100),
          state: fPercent >= 0 ? "Success" : "Error",
        };

        // 🔹 Nếu KPI model đã có thì chỉ cập nhật dữ liệu
        const oKpiContainer = this.getView().byId("kpiContainer");
        if (oKpiContainer.getItems().length > 0) {
          const oKpiCard = oKpiContainer.getItems()[0]; // lấy card đầu tiên
          const oModel = oKpiCard.getModel();
          oModel.setData(oKpi); // cập nhật model
        } else {
          // Nếu chưa có -> tạo mới (chạy lần đầu)
          this._addKpiCard(oKpi);
        }
      },

      _displayKpiCardGeneric: function (
        type,
        sPeriodKey,
        iCurrCount,
        iPrevCount
      ) {
        const fPercent =
          iPrevCount === 0
            ? iCurrCount > 0
              ? 100
              : 0
            : ((iCurrCount - iPrevCount) / iPrevCount) * 100;

        const oKpi = {
          title:
            type === "PR"
              ? "Purchase Requisition"
              : type === "RFQ"
              ? "Request for Quotation"
              : "Purchase Order",
          period: this._getPeriodLabel(sPeriodKey),
          value: iCurrCount.toLocaleString(),
          percentage: (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%",
          progress: Math.min(Math.abs(Math.round(fPercent)), 100),
          state: fPercent >= 0 ? "Success" : "Error",
        };

        // 🔹 Thêm card vào container
        this._addKpiCard(oKpi);
      },

      /* ===== Hiển thị Donut Chart ===== */
      _displayStatusDonutChart: function (aChartData) {
        const oVizFrame = this.getView().byId("idDonutChart");
        if (!oVizFrame) return;

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        // Gán màu theo trạng thái
        const mColorMap = {
        "Released": "#2e7d32",                  // xanh lá
        "Processing": "#f9a825",                // vàng
        "Processing (Reason ID)": "#c62828",    // đỏ
        "No Data": "#9e9e9e"
      };


        // Chuẩn hóa dữ liệu: thêm màu ứng với từng Status
        const aColoredData = aChartData.map((item) => ({
          Status: item.Status,
          Count: item.Count,
          Color: mColorMap[item.Status] || "#9e9e9e",
        }));

        const oChartModel = new sap.ui.model.json.JSONModel({
          items: aColoredData,
        });

        const oDataset = new sap.viz.ui5.data.FlattenedDataset({
          dimensions: [{ name: "Status", value: "{chart>Status}" }],
          measures: [{ name: "Count", value: "{chart>Count}" }],
          data: { path: "chart>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oChartModel, "chart");

        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "size",
            type: "Measure",
            values: ["Count"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "color",
            type: "Dimension",
            values: ["Status"],
          })
        );

        // ✅ Thiết lập colorPalette động theo dữ liệu thực tế
        oVizFrame.setVizProperties({
          title: { text: "PR Status Overview",
                  style: {
            fontSize: "20px",   // <-- chỉnh cỡ chữ
            fontWeight: "bold",
            color: "#000"       // tùy chọn
          },
           },
          plotArea: {
            colorPalette: aColoredData.map((d) => d.Color),
            dataLabel: { visible: true },
          },
          legend: { visible: true, position: "bottom" },
          tooltip: { visible: true },
        });
      },

      _displayStatusDonutChartPO: function (aChartData) {
        const oVizFrame = this.getView().byId("idDonutChartPO");
        if (!oVizFrame) return;

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        const mColorMap = {
          Approved: "#2e7d32", // xanh lá
          Pending: "#f9a825", // vàng
          Rejected: "#c62828", // đỏ
          "No Data": "#9e9e9e",
        };

        const aColoredData = aChartData.map((item) => ({
          Status: item.Status,
          Count: item.Count,
          Color: mColorMap[item.Status] || "#9e9e9e",
        }));

        const oChartModel = new sap.ui.model.json.JSONModel({
          items: aColoredData,
        });

        const oDataset = new sap.viz.ui5.data.FlattenedDataset({
          dimensions: [{ name: "Status", value: "{chartPO>Status}" }],
          measures: [{ name: "Count", value: "{chartPO>Count}" }],
          data: { path: "chartPO>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oChartModel, "chartPO");

        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "size",
            type: "Measure",
            values: ["Count"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "color",
            type: "Dimension",
            values: ["Status"],
          })
        );

        oVizFrame.setVizProperties({
          title: {
            text: "PO Status Overview",
            visible: true,
            alignment: "center",
            style: {
            fontSize: "20px",   // <-- chỉnh cỡ chữ
            fontWeight: "bold",
            color: "#000"       // tùy chọn
          },
          },
          plotArea: {
            colorPalette: aColoredData.map((d) => d.Color),
            dataLabel: { visible: true },
          },
          legend: { visible: true, position: "bottom" },
          tooltip: { visible: true },
        });
      },

      _displayTopMaterialBarChart: function (aChartData) {
        var oVizFrame = this.getView().byId("idBarChart");
        if (!oVizFrame) {
          console.error("❌ Bar Chart VizFrame not found!");
          return;
        }

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        var oModel = new JSONModel({ items: aChartData });
        this.getView().setModel(oModel, "topMaterial");

        var oDataset = new FlattenedDataset({
          dimensions: [{ name: "Material", value: "{topMaterial>Material}" }],
          measures: [{ name: "Count", value: "{topMaterial>Count}" }],
          data: { path: "topMaterial>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oModel, "topMaterial");

        oVizFrame.addFeed(
          new FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: ["Count"],
          })
        );
        oVizFrame.addFeed(
          new FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: ["Material"],
          })
        );

        oVizFrame.setVizProperties({
          title: {
            text: "TopMaterial",
            visible: true,
            alignment: "center",
            style: {
            fontSize: "20px",   // <-- chỉnh cỡ chữ
            fontWeight: "bold",
            color: "#000"       // tùy chọn
          }, 
          },
          plotArea: {
            colorPalette: ["#5CBAE6"],
            dataLabel: { visible: true },
          },
          legend: { visible: false },
          tooltip: { visible: true },
        });
      },

      // _displayTopVendorBarChart: function (aChartData) {
      //   const oVizFrame = this.getView().byId("idVendorBarChart");
      //   if (!oVizFrame) {
      //     console.error("❌ idVendorBarChart not found");
      //     return;
      //   }

      //   oVizFrame.destroyFeeds();
      //   oVizFrame.destroyDataset();

      //   const oModel = new JSONModel({ items: aChartData });
      //   this.getView().setModel(oModel, "topVendor");

      //   const oDataset = new FlattenedDataset({
      //     dimensions: [{ name: "Vendor", value: "{topVendor>Vendor}" }],
      //     measures: [{ name: "Count", value: "{topVendor>Count}" }],
      //     data: { path: "topVendor>/items" },
      //   });

      //   oVizFrame.setDataset(oDataset);
      //   oVizFrame.setModel(oModel, "topVendor");

      //   oVizFrame.addFeed(
      //     new FeedItem({
      //       uid: "valueAxis",
      //       type: "Measure",
      //       values: ["Count"],
      //     })
      //   );
      //   oVizFrame.addFeed(
      //     new FeedItem({
      //       uid: "categoryAxis",
      //       type: "Dimension",
      //       values: ["Vendor"],
      //     })
      //   );

      //   oVizFrame.setVizProperties({
      //     title: {
      //       text: "TopVendors",
      //       visible: true,
      //       alignment: "center",
      //     },
      //     plotArea: {
      //       colorPalette: ["#F5A623"],
      //       dataLabel: { visible: true },
      //     },
      //     legend: { visible: false },
      //     tooltip: { visible: true },
      //   });
      // },

      _displayMonthlyPRBarChart: function (aChartData) {
    const oVizFrame = this.getView().byId("idMonthlyBarChartPR");
    if (!oVizFrame) {
      console.error("❌ VizFrame idMonthlyBarChartPR not found");
      return;
    }

    // =======================
    // ⭐ MAP MONTH TO ENGLISH
    // =======================
    const MONTH_MAP = {
      1: "January",
      2: "February",
      3: "March",
      4: "April",
      5: "May",
      6: "June",
      7: "July",
      8: "August",
      9: "September",
      10: "October",
      11: "November",
      12: "December"
    };

    aChartData = aChartData.map(item => {
      let raw = item.Month;

      // If value is like "Tháng 11"
      if (typeof raw === "string" && raw.includes("Month")) {
        raw = raw.replace("Month ", "").trim();
      }

      const monthNum = parseInt(raw, 10);

      return {
        ...item,
        Month: MONTH_MAP[monthNum] || item.Month
      };
    });

    // ============ TIẾP TỤC RENDER ============
    oVizFrame.destroyFeeds();
    oVizFrame.destroyDataset();

    const oModel = new JSONModel({ items: aChartData });
    this.getView().setModel(oModel, "monthlyPR");

    const oDataset = new FlattenedDataset({
      dimensions: [{ name: "Month", value: "{monthlyPR>Month}" }],
      measures: [{ name: "Number of PR", value: "{monthlyPR>Count}" }],
      data: { path: "monthlyPR>/items" },
    });

    oVizFrame.setDataset(oDataset);
    oVizFrame.setModel(oModel, "monthlyPR");

    oVizFrame.addFeed(
      new FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: ["Month"],
      })
    );
    oVizFrame.addFeed(
      new FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: ["Number of PR"],
      })
    );

    oVizFrame.setVizType("column");

    oVizFrame.setVizProperties({
      title: {
        text: "Number of PR per Month",
        alignment: "center",
        visible: true,
      },
      plotArea: {
        colorPalette: ["#5CBAE6"],
        dataLabel: { visible: true },
      },
      legend: { visible: false },
      valueAxis: { title: { visible: false } },
      categoryAxis: { title: { visible: false }, label: { angle: 0 } },
    });
},


      _displayMonthlyPOBarChart: function (aChartData) {
    console.log("🎨 Rendering PO Chart with data:", aChartData);

    const oVizFrame = this.getView().byId("idMonthlyBarChartPO");
    if (!oVizFrame) {
      console.error("❌ VizFrame 'idMonthlyBarChartPO' not found!");
      return;
    }

    // =======================
    // ⭐ MAP MONTH TO ENGLISH
    // =======================
    const MONTH_MAP = {
      1: "January",
      2: "February",
      3: "March",
      4: "April",
      5: "May",
      6: "June",
      7: "July",
      8: "August",
      9: "September",
      10: "October",
      11: "November",
      12: "December"
    };

    aChartData = aChartData.map(item => {
        let raw = item.Month;

        // Convert "Tháng 11" → 11
        if (typeof raw === "string" && raw.includes("Month")) {
            raw = raw.replace("Month ", "").trim();
        }

        const num = parseInt(raw, 10);

        return {
            ...item,
            Month: MONTH_MAP[num] || item.Month
        };
    });

    // ======= CLEAR OLD DATA =======
    oVizFrame.destroyFeeds();
    oVizFrame.destroyDataset();

    // ======= CREATE MODEL =======
    const oModel = new sap.ui.model.json.JSONModel({ items: aChartData });
    this.getView().setModel(oModel, "monthlyPO");

    // ======= CREATE DATASET =======
    const oDataset = new sap.viz.ui5.data.FlattenedDataset({
      dimensions: [{ name: "Month", value: "{monthlyPO>Month}" }],
      measures: [{ name: "Number of PO", value: "{monthlyPO>Count}" }],
      data: { path: "monthlyPO>/items" },
    });

    oVizFrame.setDataset(oDataset);
    oVizFrame.setModel(oModel, "monthlyPO");

    // ======= ADD FEEDS =======
    oVizFrame.addFeed(
      new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: ["Month"],
      })
    );

    oVizFrame.addFeed(
      new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: ["Number of PO"],
      })
    );

    // ======= SET TYPE =======
    oVizFrame.setVizType("column");

    const sDocType = this._currentPoType === "A" ? "RFQ" : "PO";

    // ======= DISPLAY PROPERTIES =======
    oVizFrame.setVizProperties({
      title: {
        text:
          aChartData.length > 0 && aChartData[0].Month.startsWith("Year")
            ? `Number of ${sDocType} per year`
            : `Number of ${sDocType} per month`,
        alignment: "center",
        visible: true,
      },
      plotArea: {
        colorPalette: [sDocType === "A" ? "#2196F3" : "#4CAF50"],
        dataLabel: { visible: true },
      },
      legend: { visible: false },
      valueAxis: { title: { visible: false } },
      categoryAxis: {
        title: { visible: false },
        label: { angle: 0 },
      },
    });

    console.log("✅ PO Chart rendered successfully");
},


      _displayConnectedScatterChart: function (aChartData) {
        const oVizFrame = this.byId("idConnectedChart");
        if (!oVizFrame) return;

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        // ✅ Gom dữ liệu tổng theo tháng và loại chứng từ
        const mAgg = {};
        aChartData.forEach((item) => {
          if (!item.Date || !item.Phase) return;
          const date = new Date(item.Date);
          if (isNaN(date)) return;

          const monthKey = `${date.getFullYear()}-${(
            "0" +
            (date.getMonth() + 1)
          ).slice(-2)}`;
          const key = `${monthKey}_${item.Phase}`;

          if (!mAgg[key]) {
            mAgg[key] = { Date: monthKey, Phase: item.Phase, Amount: 0 };
          }
          mAgg[key].Amount += Number(item.Amount) || 0;
        });

        // ✅ Sắp xếp thời gian tăng dần
        const aProcessed = Object.values(mAgg).sort((a, b) =>
          a.Date.localeCompare(b.Date)
        );

        // ✅ Chuẩn hóa dữ liệu cho hiển thị đẹp (chuyển sang triệu hoặc tỷ)
        const aFormatted = aProcessed.map((item) => {
          let displayAmount = item.Amount;
          let unit = "VND";

          // if (displayAmount >= 1_000_000_000) {
          //   displayAmount = displayAmount / 1_000_000_000;
          //   unit = "Billion VND";
          // } else if (displayAmount >= 1_000_000) {
          //   displayAmount = displayAmount / 1_000_000;
          //   unit = "Million VND";
          // }

          return {
            Date: item.Date,
            Phase: item.Phase,
            Amount: item.Amount,
            DisplayAmount: displayAmount,
            Unit: unit,
          };
        });
        console.log("cc1", aFormatted);

        this._originalConnectedChartData = aFormatted;

        const aVisible = aFormatted.filter(
          (item) => !this._hiddenPhases[item.Phase]
        );
        const oModel = new sap.ui.model.json.JSONModel({ items: aVisible });
        this.getView().setModel(oModel, "chart");

        const oDataset = new sap.viz.ui5.data.FlattenedDataset({
          dimensions: [
            { name: "Time Line", value: "{chart>Date}" },
            { name: "Type of document", value: "{chart>Phase}" },
          ],
          measures: [{ name: "Value", value: "{chart>DisplayAmount}" }],
          data: { path: "chart>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oModel, "chart");

        // ✅ Feeds
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: ["Time Line"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "color",
            type: "Dimension",
            values: ["Type of document"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: ["Value"],
          })
        );

        oVizFrame.setVizType("line");

        // ✅ Lấy đơn vị lớn nhất để đặt trục tung
        const firstUnit = aFormatted.length > 0 ? aFormatted[0].Unit : "VND";

        // ✅ Hiển thị đẹp như PR chart
        oVizFrame.setVizProperties({
          title: {
            text: `PR / RFQ / PO Value by Timeline (${firstUnit})`,
            visible: true,
            alignment: "center",
          },
          plotArea: {
            dataLabel: {
              visible: true,
              // formatString: "n1", // 1 chữ số thập phân
              style: { fontSize: "10px", color: "#333" },
            },
            marker: { visible: true, size: 5 },
            colorPalette: ["#1976D2", "#F57C00", "#388E3C"],
            window: { start: "firstDataPoint", end: "lastDataPoint" },
          },
          valueAxis: {
            title: { visible: true, text: `Value (${firstUnit})` },
            // label: { formatString: "n1" }
          },
          categoryAxis: {
            title: { visible: true, text: "Time Line (Month/Year)" },
            label: { angle: -45, style: { fontSize: "11px" } },
          },
          tooltip: {
            visible: true,
            formatString: "n0", // ✅ tooltip hiển thị đầy đủ số tiền gốc (không chia)
          },
        });
        this._refreshConnectedChart();
      },

      /* ===== Tạo KPI Card Fragment ===== */
      _addKpiCard: function (oData) {
        var oHBox = this.getView().byId("kpiContainer");
        if (!oHBox) {
          console.error("❌ kpiContainer not found!");
          return;
        }

        Fragment.load({
          id: this.getView().getId() + "_kpiFragment_" + Date.now(),
          name: "demodashboard.fragment.Kpi",
          controller: this,
        })
          .then(
            function (oFrag) {
              var oModel = new JSONModel(oData);
              oFrag.setModel(oModel);
              oHBox.addItem(oFrag);
            }.bind(this)
          )
          .catch(function (err) {
            console.error("❌ KPI Fragment load error:", err);
          });
      },

      /* ===== Helper Functions ===== */
      _countUniqueBanfn: function (aRows) {
        var s = new Set();
        aRows.forEach(function (r) {
          if (r.Banfn) s.add(r.Banfn);
        });
        return s.size;
      },

      _getDateRange: function (key) {
        var now = new Date();
        var start,
          end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          );

        switch (key) {
          case "today":
            start = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              0,
              0,
              0,
              0
            );
            break;
          case "thisWeek":
            start = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - now.getDay(),
              0,
              0,
              0,
              0
            );
            break;
          case "thisMonth":
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
          case "thisQuarter":
            var q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
            break;
          case "thisYear":
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            break; // ✅ ADD THIS
          case "thisAll":
            start = new Date(1900, 0, 1, 0, 0, 0, 0);
            end = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
              999
            );
            break;
          default:
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        }

        return { start: start, end: end };
      },

      _getPreviousRange: function (key) {
        var now = new Date();
        var start, end;

        switch (key) {
          case "today":
            var y = new Date(now);
            y.setDate(now.getDate() - 1);
            start = new Date(
              y.getFullYear(),
              y.getMonth(),
              y.getDate(),
              0,
              0,
              0,
              0
            );
            end = new Date(
              y.getFullYear(),
              y.getMonth(),
              y.getDate(),
              23,
              59,
              59,
              999
            );
            break;
          case "thisWeek":
            start = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - now.getDay() - 7,
              0,
              0,
              0,
              0
            );
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            break;
          case "thisMonth":
            start = new Date(
              now.getFullYear(),
              now.getMonth() - 1,
              1,
              0,
              0,
              0,
              0
            );
            end = new Date(
              now.getFullYear(),
              now.getMonth(),
              0,
              23,
              59,
              59,
              999
            );
            break;
          case "thisQuarter":
            var q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), (q - 1) * 3, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
            break;
          case "thisYear":
            start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
          default:
            start = new Date(
              now.getFullYear(),
              now.getMonth() - 1,
              1,
              0,
              0,
              0,
              0
            );
            end = new Date(
              now.getFullYear(),
              now.getMonth(),
              0,
              23,
              59,
              59,
              999
            );
        }
        return { start: start, end: end };
      },

      _getPeriodLabel: function (key) {
        var now = new Date();
        switch (key) {
          case "today":
            return "Today";
          case "thisWeek":
            return "This Week";
          case "thisMonth":
            return "This Month" + (now.getMonth() + 1);
          case "thisQuarter":
            return "This Quater " + (Math.floor(now.getMonth() / 3) + 1);
          case "thisYear":
            return "Year " + now.getFullYear();
          case "thisAll":
            return "All Time";
          default:
            return "";
        }
      },

      _parseDate: function (sDate) {
        if (typeof sDate === "string") {
          const match = /Date\((\d+)\)/.exec(sDate);
          if (match) return new Date(parseInt(match[1], 10));
        }
        return sDate instanceof Date ? sDate : null;
      },

      onTogglePhase: function (oEvent) {
        var sPhase = oEvent.getSource().getText(); // “PR”, “PO”, “RFQ”
        var bSelected = oEvent.getParameter("selected");
        this._hiddenPhases[sPhase] = !bSelected;

        // gọi lại biểu đồ Connected
        this._refreshConnectedChart();
      },

      _refreshConnectedChart: function () {
        const oVizFrame = this.byId("idConnectedChart");
        if (!oVizFrame) {
          console.error("VizFrame idConnectedChart not found!");
          return;
        }

        // Reload lại đúng chart với trạng thái phase đã toggle
        const oModel = this.getView().getModel("chart");
        const aItems = this._originalConnectedChartData || [];

        // Lọc dữ liệu theo trạng thái toggle (ẩn/hiện)
        const aFiltered = aItems.filter(
          (item) => !this._hiddenPhases[item.Phase]
        );

        // Gán model mới
        const oNewModel = new sap.ui.model.json.JSONModel({ items: aFiltered });
        this.getView().setModel(oNewModel, "chart");
        oVizFrame.setModel(oNewModel, "chart");

        // ⚠️ MUST: Reset lại dataset và feeds
        oVizFrame.destroyDataset();
        oVizFrame.destroyFeeds();

        const oDataset = new sap.viz.ui5.data.FlattenedDataset({
          dimensions: [
            { name: "Timeline", value: "{chart>Date}" },
            { name: "Type of Document", value: "{chart>Phase}" },
          ],
          measures: [{ name: "Value", value: "{chart>DisplayAmount}" }],
          data: { path: "chart>/items" },
        });

        oVizFrame.setDataset(oDataset);

        // Add feeds lại
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: ["Timeline"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "color",
            type: "Dimension",
            values: ["Type of Document"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: ["Value"],
          })
        );

        // Optional: Giữ lại các vizProperties nếu muốn
        oVizFrame.setVizProperties({
          title: {
            text: "PR / RFQ / PO value by time (VND)",
            visible: true,
            alignment: "center",
          },
          plotArea: {
            dataLabel: { visible: true },
            marker: { visible: true, size: 5 },
            colorPalette: ["#1976D2", "#F57C00", "#388E3C"],
          },
          valueAxis: {
            title: { visible: true, text: "Value (VND)" },
          },
          categoryAxis: {
            title: { visible: true, text: "Timeline (Month/Year)" },
            label: { angle: -45 },
          },
          tooltip: { visible: true },
        });
      },

      onGoToPRList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("PRList");
      },

      onGoToRFQList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("RFQList");
      },
      onGoToPOList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("POList");
      },
    });
  }
);