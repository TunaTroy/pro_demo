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

<<<<<<< HEAD
      return Controller.extend("demodashboard.controller.DashboardPR", {
        onInit: function () {
          this.oOData = this.getOwnerComponent().getModel(); // OData model
          this._reloadChartsOnly("thisYear");     
          this._currentRequesterSort = "totalPR";
          
        },
=======
    return Controller.extend("demodashboard.controller.DashboardPR", {
      onInit: function () {
        this.oOData = this.getOwnerComponent().getModel(); // OData model
        this._reloadChartsOnly("thisYear");
        this._currentPoType = "F";
        this._currentRequesterSort = "totalPR";
      },
>>>>>>> 903bcb221159d0ce1878c1b0a0a5f9e58be78724

      onTimeFilterChange: function (oEvent) {
        var sKey = oEvent.getSource().getSelectedKey();
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

      /* ===== Tải toàn bộ dashboard ===== */
      _reloadChartsOnly: function (sPeriodKey) {
        BusyIndicator.show(0);

        Promise.all([
          this._loadKpiPurchaseRequisition(sPeriodKey),
          this._loadStatusDonutChart(sPeriodKey),
          this._loadTopMaterialBarChart(sPeriodKey),
          this._loadTopVendorBarChart(sPeriodKey),
          this._loadTopRequesterTable(sPeriodKey),
          this._loadMonthlyPRBarChart(sPeriodKey),
          this._loadMonthlyPoBarChart(sPeriodKey),
        ]).finally(() => {
          BusyIndicator.hide(); // ✅ Thêm dòng này để đóng BusyIndicator
        });
      },

<<<<<<< HEAD
          return Promise.all([
            this._loadKpiPurchaseRequisition(sPeriodKey),
            this._loadStatusDonutChart(sPeriodKey),
            this._loadTopMaterialBarChart(sPeriodKey),        
            this._loadTopRequesterTable(sPeriodKey),
            this._loadMonthlyPRBarChart(sPeriodKey),
            this._loadMonthlyRFQBarChart(sPeriodKey)

          ]);   
        },
=======
      /* ===== Load KPI ===== */
      _loadKpiPurchaseRequisition: function (sPeriodKey) {
        BusyIndicator.show(0);
        var oCurrRange = this._getDateRange(sPeriodKey);
        var oPrevRange = this._getPreviousRange(sPeriodKey);
>>>>>>> 903bcb221159d0ce1878c1b0a0a5f9e58be78724

        this.oOData.read("/PRsSet", {
          urlParameters: {
            $select: "Banfn,Badat",
            $top: "500",
          },
          success: function (oData) {
            BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
              MessageToast.show("Không có dữ liệu Purchase Requisition");
              this._displayKpiCard(sPeriodKey, iCurrCount, iPrevCount);
              return;
            }

            // Parse BADAT
            oData.results.forEach(function (r) {
              if (r.Badat && typeof r.Badat === "string") {
                var match = /Date\((\d+)\)/.exec(r.Badat);
                if (match) r.Badat = new Date(parseInt(match[1], 10));
              }
            });

            // Lọc dữ liệu theo range
            var aCurr = oData.results.filter(function (r) {
              return (
                r.Badat &&
                r.Badat >= oCurrRange.start &&
                r.Badat <= oCurrRange.end
              );
            });
            var aPrev = oData.results.filter(function (r) {
              return (
                r.Badat &&
                r.Badat >= oPrevRange.start &&
                r.Badat <= oPrevRange.end
              );
            });

            var iCurrCount = this._countUniqueBanfn(aCurr);
            var iPrevCount = this._countUniqueBanfn(aPrev);

            this._displayKpiCard(sPeriodKey, iCurrCount, iPrevCount);
          }.bind(this),

          error: function (e) {
            BusyIndicator.hide();
            console.error("❌ OData Read error:", e);
            MessageToast.show("Lỗi khi tải dữ liệu KPI");
            this._displayKpiCard(sPeriodKey, 0, 0);
          }.bind(this),
        });
      },

      /* ===== Load Status Donut Chart ===== */
      _loadStatusDonutChart: function (sPeriodKey) {
        BusyIndicator.show(0);
        var oCurrRange = this._getDateRange(sPeriodKey);

        this.oOData.read("/PRsSet", {
          urlParameters: {
            $select: "Banfn,Badat,Frgkz",
            $top: "5000",
          },
          success: function (oData) {
            BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
              MessageToast.show("Không có dữ liệu Status");
              this._displayStatusDonutChart([
                { Status: "Approved", Count: 0 },
                { Status: "Pending", Count: 0 },
                { Status: "Rejected", Count: 0 },
              ]);
              return;
            }

            // Parse BADAT
            oData.results.forEach(function (r) {
              if (r.Badat && typeof r.Badat === "string") {
                var match = /Date\((\d+)\)/.exec(r.Badat);
                if (match) r.Badat = new Date(parseInt(match[1], 10));
              }
            });

            // Lọc theo khoảng thời gian
            var aCurr = oData.results.filter(function (r) {
              return (
                r.Badat &&
                r.Badat >= oCurrRange.start &&
                r.Badat <= oCurrRange.end
              );
            });

            // Đếm trạng thái: R=Approved, C=Pending, X=Rejected
            var iApproved = 0,
              iPending = 0,
              iRejected = 0;
            aCurr.forEach(function (r) {
              if (r.Frgkz === "R") iApproved++;
              else if (r.Frgkz === "C") iPending++;
              else if (r.Frgkz === "X") iRejected++;
            });

            var aChartData = [
              { Status: "Approved", Count: iApproved },
              { Status: "Pending", Count: iPending },
              { Status: "Rejected", Count: iRejected },
            ].filter(function (item) {
              return item.Count > 0;
            });

            if (aChartData.length === 0) {
              aChartData = [{ Status: "No Data", Count: 1 }];
            }

            this._displayStatusDonutChart(aChartData);
          }.bind(this),

          error: function (e) {
            BusyIndicator.hide();
            MessageToast.show("Lỗi khi tải dữ liệu Status");
            this._displayStatusDonutChart([{ Status: "No Data", Count: 1 }]);
          }.bind(this),
        });
      },

      /* ===== Load Bar Chart: Top Material ===== */
      _loadTopMaterialBarChart: function (sPeriodKey) {
        BusyIndicator.show(0);
        var oCurrRange = this._getDateRange(sPeriodKey);

        this.oOData.read("/PRsSet", {
          urlParameters: {
            $select: "Banfn,Badat,Txz01",
            $top: "5000",
          },
          success: function (oData) {
            BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
              MessageToast.show("Không có dữ liệu vật tư");
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
              var key = r.Txz01 || "Không xác định";
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
            MessageToast.show("Lỗi khi tải dữ liệu vật tư");
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

            // 🔹 Gọi PRsSet sau khi đã có map vendor
            this.oOData.read("/PRsSet", {
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
                MessageToast.show("Lỗi khi đọc PRsSet");
              }.bind(this),
            });
          }.bind(this),
          error: function (e) {
            BusyIndicator.hide();
            MessageToast.show("Lỗi khi đọc VendorsSet");
          }.bind(this),
        });
      },

      _loadMonthlyPRBarChart: function (sPeriodKey) {
        return new Promise((resolve, reject) => {
          BusyIndicator.show(0);

          this.oOData.read("/PRsSet", {
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
                    Month: `Năm ${year}`,
                    Count: yearCountMap[year] || 0,
                  });
                }

                this._displayMonthlyPRBarChart(aChartData);
                resolve();
              } else {
                const year = range.start.getFullYear();
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
                  Month: `Tháng ${i + 1}`,
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
              console.error("❌ Lỗi load Monthly PR:", e);
              this._displayMonthlyPRBarChart([]);
              reject(e);
            },
          });
        });
      },

      _loadTopRequesterTable: function () {
        BusyIndicator.show(0);

        this.oOData.read("/PRsSet", {
          urlParameters: {
            $select: "Banfn,Ernam,Badat,Frgkz,Frgdt",
            $top: "2000",
          },
          success: (oData) => {
            BusyIndicator.hide();
            const aResults = oData.results || [];

<<<<<<< HEAD
      // Normalize dates
      aResults.forEach(r => {
        ["Badat", "Frgdt"].forEach(field => {
          if (typeof r[field] === "string") {
            const m = /Date\((\d+)\)/.exec(r[field]);
            if (m) r[field] = new Date(parseInt(m[1], 10));
          }
        });
      });

      // Group by Ernam (user)
      const oUserMap = {};
      aResults.forEach(r => {
        const user = r.Ernam || "UNKNOWN";
        if (!oUserMap[user]) {
          oUserMap[user] = {
            UserID: user,
            FullName: user, // fallback; you can replace with lookup later
            TotalPR: 0,
            ApprovedPR: 0,
            PendingPR: 0,
            ApprovalDays: [],
            Dates: []
          };
        }

        oUserMap[user].TotalPR++;
        if (r.Badat) oUserMap[user].Dates.push(r.Badat);

        // Count statuses
        if (r.Frgkz === "R") { // Approved (your mapping)
          oUserMap[user].ApprovedPR++;
          // If release date available - calculate approval days
          if (r.Badat && r.Frgdt) {
            const diffDays = Math.max(0, Math.round((r.Frgdt - r.Badat) / (1000 * 60 * 60 * 24)));
            oUserMap[user].ApprovalDays.push(diffDays);
          }
        } else if (r.Frgkz === "C") { // Pending
          oUserMap[user].PendingPR++;
        }
      });

      // Build array without index yet
      const aUsers = Object.values(oUserMap).map(u => {
        const approvalRateNum = u.TotalPR > 0 ? (u.ApprovedPR / u.TotalPR * 100) : 0;
        const approvalRate = u.TotalPR > 0 ? approvalRateNum.toFixed(1) + "%" : "0%";
        const avgDays = u.ApprovalDays.length > 0
          ? (u.ApprovalDays.reduce((a,b) => a+b, 0) / u.ApprovalDays.length).toFixed(1)
          : null; // null means '-' in UI

        const lastDate = u.Dates.length > 0 ? new Date(Math.max(...u.Dates)).toLocaleDateString() : "-";

        return {
          UserID: u.UserID,
          TotalPR: u.TotalPR,
          ApprovedPR: u.ApprovedPR,
          ApprovalRate: approvalRate,
          ApprovalRateNum: approvalRateNum, 
          PendingPR: u.PendingPR,
          AvgApprovalDays: avgDays,
          LastCreatedDate: lastDate
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
          if (b.ApprovalRateNum !== a.ApprovalRateNum) return b.ApprovalRateNum - a.ApprovalRateNum;
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
      const aTop = aUsers.slice(0, 50).map((item, idx) => {
        return Object.assign({}, item, {
          index: idx + 1,
          // format fields for display
          ApprovalRate: item.ApprovalRate,
          AvgApprovalDaysDisplay: item.AvgApprovalDays !== null ? item.AvgApprovalDays + " days" : "- days"
        });
      });

      const oModel = new sap.ui.model.json.JSONModel({ items: aTop });
      this.getView().setModel(oModel, "topRequesterModel");
    },

    error: (e) => {
      BusyIndicator.hide();
      console.error("❌ Lỗi khi tải dữ liệu Top Requesters:", e);
      MessageToast.show("Lỗi khi tải dữ liệu Top Requesters");
    }
  });
},


/* ===== Load Monthly RFQ Chart ===== */
_loadMonthlyRFQBarChart: function (sPeriodKey) {
  return new Promise((resolve, reject) => {
    BusyIndicator.show(0);

    // ⚙️ Đọc dữ liệu RFQ
    this.oOData.read("/PRsSet", {
      urlParameters: { $select: "Banfn,Badat", $top: "2000" },
      success: (oData) => {
        BusyIndicator.hide();
        const aResults = oData.results || [];
        if (aResults.length === 0) {
          this._displayMonthlyRFQBarChart([]);
          return resolve();
        }

     
        aResults.forEach((r) => {
          if (typeof r.Badat === "string") {
            const match = /Date\((\d+)\)/.exec(r.Badat);
            if (match) r.Badat = new Date(parseInt(match[1], 10));
          }
        });

        const range = this._getDateRange(sPeriodKey);
        const uniqueSet = new Set();

        // 🔹 Nếu filter là "Tất cả năm"
        if (sPeriodKey === "thisAll") {
          const yearCountMap = {};

          aResults.forEach((r) => {
            if (
              r.Badat instanceof Date &&
              r.Badat >= range.start &&
              r.Badat <= range.end
            ) {
              const year = r.Badat.getFullYear();
              const key = `${r.Ebeln}-${year}`;
              if (!uniqueSet.has(key)) {
                uniqueSet.add(key);
                yearCountMap[year] = (yearCountMap[year] || 0) + 1;
              }
            }
          });

          // 🔍 Xác định range năm từ nhỏ nhất đến hiện tại
          const validYears = aResults
            .filter(r => r.Badat instanceof Date)
            .map(r => r.Badat.getFullYear());
          const minYear = Math.min(...validYears);
          const maxYear = new Date().getFullYear();

          const aChartData = [];
          for (let year = minYear; year <= maxYear; year++) {
            aChartData.push({
              Month: `Năm ${year}`,
              Count: yearCountMap[year] || 0,
            });
          }

          this._displayMonthlyRFQBarChart(aChartData);
          return resolve();
        }

        // 🔹 Ngược lại: chỉ 1 năm → gom theo tháng
        const year = range.start.getFullYear();
        const monthlyCount = Array(12).fill(0);

        aResults.forEach((r) => {
          if (r.Badat instanceof Date && r.Badat.getFullYear() === year) {
            const month = r.Badat.getMonth(); // 0–11
            const key = `${r.Ebeln}-${month}`;
            if (!uniqueSet.has(key)) {
              uniqueSet.add(key);
              monthlyCount[month]++;
            }
          }
        });

        const aChartData = monthlyCount.map((count, i) => ({
          Month: `Tháng ${i + 1}`,
          Count: count,
        }));

        this._displayMonthlyRFQBarChart(aChartData);
        resolve();
      },

      error: (e) => {
        BusyIndicator.hide();
        console.error("❌ Lỗi load Monthly RFQ:", e);
        this._displayMonthlyRFQBarChart([]);
        reject(e);
      },
    });
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

        /* ===== Hiển thị Donut Chart ===== */
        _displayStatusDonutChart: function (aChartData) {
          const oVizFrame = this.getView().byId("idDonutChart");
          if (!oVizFrame) return;

          oVizFrame.destroyFeeds();
          oVizFrame.destroyDataset();

          // Gán màu theo trạng thái
          const mColorMap = {
            Approved: "#2e7d32", // xanh lá
            Pending: "#f9a825", // vàng
            Rejected: "#c62828", // đỏ
            "No Data": "#9e9e9e", // xám
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
            title: { text: "PR Status Overview" },
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
            console.error("❌ Không tìm thấy Bar Chart VizFrame!");
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
              text: "Top 5 Best Material",
              visible: true,
              alignment: "center", 
            },
            plotArea: {
              colorPalette: ["#5CBAE6"],
              dataLabel: { visible: true },
            },
            legend: { visible: false },
            tooltip: { visible: true },
          });
        },

        _displayMonthlyPRBarChart: function (aChartData) {
          const oVizFrame = this.getView().byId("idMonthlyBarChart");
          if (!oVizFrame) {
            console.error("❌ Không tìm thấy VizFrame idMonthlyBarChart");
            return;
          }

          oVizFrame.destroyFeeds();
          oVizFrame.destroyDataset();

          const oModel = new JSONModel({ items: aChartData });
          this.getView().setModel(oModel, "monthlyPR");

          const oDataset = new FlattenedDataset({
            dimensions: [{ name: "Tháng", value: "{monthlyPR>Month}" }],
            measures: [{ name: "Số lượng PR", value: "{monthlyPR>Count}" }],
            data: { path: "monthlyPR>/items" },
          });

          oVizFrame.setDataset(oDataset);
          oVizFrame.setModel(oModel, "monthlyPR");

          oVizFrame.addFeed(
            new FeedItem({
              uid: "categoryAxis",
              type: "Dimension",
              values: ["Tháng"],
            })
          );
          oVizFrame.addFeed(
            new FeedItem({
              uid: "valueAxis",
              type: "Measure",
              values: ["Số lượng PR"],
            })
          );

          oVizFrame.setVizType("column");

          oVizFrame.setVizProperties({
            title: {
              text:
                aChartData.length > 0 && aChartData[0].Month.startsWith("Năm")
                  ? "Số lượng PR theo năm (Toàn bộ thời gian)"
                  : "Số lượng PR theo tháng (năm hiện tại)",
              alignment: "center",
              visible: true,
            },
            plotArea: {
              colorPalette: ["#5CBAE6"],
              dataLabel: { visible: true },
            },
            legend: { visible: false },
            valueAxis: {
              title: { visible: false },
            },
            categoryAxis: {
              title: { visible: false },
              label: { angle: 0 },
            },
          });
        },


        /* ===== Hiển thị biểu đồ RFQ ===== */
_displayMonthlyRFQBarChart: function (aChartData) {
  const oVizFrame = this.getView().byId("idMonthlyRFQBarChart");
  if (!oVizFrame) {
    console.error("❌ Không tìm thấy VizFrame idMonthlyRFQBarChart");
    return;
  }

  // Dọn sạch trước khi vẽ mới
  oVizFrame.destroyFeeds();
  oVizFrame.destroyDataset();

  // Tạo model chứa dữ liệu RFQ
  const oModel = new sap.ui.model.json.JSONModel({ items: aChartData });
  this.getView().setModel(oModel, "monthlyRFQ");

  // Dataset cho RFQ
  const oDataset = new sap.viz.ui5.data.FlattenedDataset({
    dimensions: [{ name: "Tháng", value: "{monthlyRFQ>Month}" }],
    measures: [{ name: "Số lượng RFQ", value: "{monthlyRFQ>Count}" }],
    data: { path: "monthlyRFQ>/items" },
  });

  oVizFrame.setDataset(oDataset);
  oVizFrame.setModel(oModel, "monthlyRFQ");

  // Thêm FeedItem (dữ liệu đo lường và trục)
  oVizFrame.addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
      uid: "categoryAxis",
      type: "Dimension",
      values: ["Tháng"],
    })
  );
  oVizFrame.addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
      uid: "valueAxis",
      type: "Measure",
      values: ["Số lượng RFQ"],
    })
  );

  // Cấu hình loại biểu đồ
  oVizFrame.setVizType("column");

  // Thiết lập thuộc tính hiển thị
  oVizFrame.setVizProperties({
    title: {
      text:
        aChartData.length > 0 && aChartData[0].Month.startsWith("Năm")
          ? "Số lượng RFQ theo năm (Toàn bộ thời gian)"
          : "Số lượng RFQ theo tháng (năm hiện tại)",
      alignment: "center",
      visible: true,
    },
    plotArea: {
      colorPalette: ["#FFB347"], // 🟧 Màu cam khác PR
      dataLabel: { visible: true },
    },
    legend: { visible: false },
    valueAxis: {
      title: { visible: false },
    },
    categoryAxis: {
      title: { visible: false },
      label: { angle: 0 },
    },
  });
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
=======
            // Normalize dates
            aResults.forEach((r) => {
              ["Badat", "Frgdt"].forEach((field) => {
                if (typeof r[field] === "string") {
                  const m = /Date\((\d+)\)/.exec(r[field]);
                  if (m) r[field] = new Date(parseInt(m[1], 10));
                }
              });
>>>>>>> 903bcb221159d0ce1878c1b0a0a5f9e58be78724
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
            const aTop = aUsers.slice(0, 50).map((item, idx) => {
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
            console.error("❌ Lỗi khi tải dữ liệu Top Requesters:", e);
            MessageToast.show("Lỗi khi tải dữ liệu Top Requesters");
          },
        });
      },

      _loadMonthlyPoBarChart: function (sPeriodKey) {
        return new Promise((resolve, reject) => {
          BusyIndicator.show(0);

          if (!sPeriodKey) sPeriodKey = "thisYear";

          const sDocType = this._currentPoType || "F"; // ✅ lấy từ Select hiện tại

          this.oOData.read("/ProcurementHeaderSet", {
            urlParameters: {
              $select: "Ebeln,Aedat,Bstyp",
              $top: "2000",
            },
            success: (oData) => {
              BusyIndicator.hide();

              // ✅ Lọc theo loại chứng từ đã chọn (PO hoặc RFQ)
              const aResults = oData.results.filter(
                (r) => r.Bstyp === sDocType
              );
              console.log(
                `📦 Raw Data (Bstyp=${sDocType}):`,
                aResults.slice(0, 5)
              );

              if (aResults.length === 0) {
                MessageToast.show(
                  `Không có dữ liệu cho loại ${sDocType === "F" ? "PO" : "RFQ"}`
                );
                this._displayMonthlyPOBarChart([]);
                return resolve();
              }

              // Parse ngày
              aResults.forEach((r) => {
                if (typeof r.Aedat === "string") {
                  const match = /Date\((\d+)\)/.exec(r.Aedat);
                  if (match) r.Aedat = new Date(parseInt(match[1], 10));
                }
              });

              const aValidRecords = aResults.filter(
                (r) => r.Aedat instanceof Date && !isNaN(r.Aedat)
              );

              const range = this._getDateRange(sPeriodKey);
              const uniqueSet = new Set();
              let aChartData = [];

              if (sPeriodKey === "thisAll") {
                const yearCountMap = {};
                aValidRecords.forEach((r) => {
                  if (r.Aedat >= range.start && r.Aedat <= range.end) {
                    const year = r.Aedat.getFullYear();
                    const key = `${r.Ebeln}-${year}`;
                    if (!uniqueSet.has(key)) {
                      uniqueSet.add(key);
                      yearCountMap[year] = (yearCountMap[year] || 0) + 1;
                    }
                  }
                });
                const minYear = Math.min(
                  ...aValidRecords.map((r) => r.Aedat.getFullYear())
                );
                const maxYear = new Date().getFullYear();
                for (let year = minYear; year <= maxYear; year++) {
                  aChartData.push({
                    Month: `Năm ${year}`,
                    Count: yearCountMap[year] || 0,
                  });
                }
              } else {
                const year = range.start.getFullYear();
                const monthlyCount = Array(12).fill(0);
                aValidRecords.forEach((r) => {
                  if (
                    r.Aedat.getFullYear() === year &&
                    r.Aedat >= range.start &&
                    r.Aedat <= range.end
                  ) {
                    const month = r.Aedat.getMonth();
                    const key = `${r.Ebeln}-${month}`;
                    if (!uniqueSet.has(key)) {
                      uniqueSet.add(key);
                      monthlyCount[month]++;
                    }
                  }
                });
                aChartData = monthlyCount.map((count, i) => ({
                  Month: `Tháng ${i + 1}`,
                  Count: count,
                }));
              }

              this._displayMonthlyPOBarChart(aChartData);
              resolve();
            },

            error: (e) => {
              BusyIndicator.hide();
              console.error("❌ Lỗi load Monthly PO:", e);
              MessageToast.show("Không thể tải dữ liệu PO/RFQ");
              this._displayMonthlyPOBarChart([]);
              reject(e);
            },
          });
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

      /* ===== Hiển thị Donut Chart ===== */
      _displayStatusDonutChart: function (aChartData) {
        const oVizFrame = this.getView().byId("idDonutChart");
        if (!oVizFrame) return;

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        // Gán màu theo trạng thái
        const mColorMap = {
          Approved: "#2e7d32", // xanh lá
          Pending: "#f9a825", // vàng
          Rejected: "#c62828", // đỏ
          "No Data": "#9e9e9e", // xám
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
          title: { text: "PR Status Overview" },
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
          console.error("❌ Không tìm thấy Bar Chart VizFrame!");
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
            alignment: "center", // 👈 THÊM DÒNG NÀY
          },
          plotArea: {
            colorPalette: ["#5CBAE6"],
            dataLabel: { visible: true },
          },
          legend: { visible: false },
          tooltip: { visible: true },
        });
      },

      _displayTopVendorBarChart: function (aChartData) {
        const oVizFrame = this.getView().byId("idVendorBarChart");
        if (!oVizFrame) {
          console.error("❌ Không tìm thấy idVendorBarChart");
          return;
        }

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        const oModel = new JSONModel({ items: aChartData });
        this.getView().setModel(oModel, "topVendor");

        const oDataset = new FlattenedDataset({
          dimensions: [{ name: "Vendor", value: "{topVendor>Vendor}" }],
          measures: [{ name: "Count", value: "{topVendor>Count}" }],
          data: { path: "topVendor>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oModel, "topVendor");

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
            values: ["Vendor"],
          })
        );

        oVizFrame.setVizProperties({
          title: {
            text: "TopVendors",
            visible: true,
            alignment: "center",
          },
          plotArea: {
            colorPalette: ["#F5A623"],
            dataLabel: { visible: true },
          },
          legend: { visible: false },
          tooltip: { visible: true },
        });
      },

      _displayMonthlyPRBarChart: function (aChartData) {
        const oVizFrame = this.getView().byId("idMonthlyBarChartPR");
        if (!oVizFrame) {
          console.error("❌ Không tìm thấy VizFrame idMonthlyBarChartPR");
          return;
        }

        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        const oModel = new JSONModel({ items: aChartData });
        this.getView().setModel(oModel, "monthlyPR");

        const oDataset = new FlattenedDataset({
          dimensions: [{ name: "Tháng", value: "{monthlyPR>Month}" }],
          measures: [{ name: "Số lượng PR", value: "{monthlyPR>Count}" }],
          data: { path: "monthlyPR>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oModel, "monthlyPR");

        oVizFrame.addFeed(
          new FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: ["Tháng"],
          })
        );
        oVizFrame.addFeed(
          new FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: ["Số lượng PR"],
          })
        );

        oVizFrame.setVizType("column");

        oVizFrame.setVizProperties({
          title: {
            text:
              aChartData.length > 0 && aChartData[0].Month.startsWith("Năm")
                ? "Số lượng PR theo năm (Toàn bộ thời gian)"
                : "Số lượng PR theo tháng (năm hiện tại)",
            alignment: "center",
            visible: true,
          },
          plotArea: {
            colorPalette: ["#5CBAE6"],
            dataLabel: { visible: true },
          },
          legend: { visible: false },
          valueAxis: {
            title: { visible: false },
          },
          categoryAxis: {
            title: { visible: false },
            label: { angle: 0 },
          },
        });
      },

      _displayMonthlyPOBarChart: function (aChartData) {
        console.log("🎨 Rendering PO Chart with data:", aChartData);

        const oVizFrame = this.getView().byId("idMonthlyBarChartPO");
        if (!oVizFrame) {
          console.error("❌ VizFrame 'idMonthlyBarChartPO' not found!");
          return;
        }

        // ✅ Clear existing feeds/dataset
        oVizFrame.destroyFeeds();
        oVizFrame.destroyDataset();

        // ✅ Tạo model mới
        const oModel = new sap.ui.model.json.JSONModel({ items: aChartData });
        this.getView().setModel(oModel, "monthlyPO");

        // ✅ Tạo dataset
        const oDataset = new sap.viz.ui5.data.FlattenedDataset({
          dimensions: [{ name: "Tháng", value: "{monthlyPO>Month}" }],
          measures: [{ name: "Số lượng PO", value: "{monthlyPO>Count}" }],
          data: { path: "monthlyPO>/items" },
        });

        oVizFrame.setDataset(oDataset);
        oVizFrame.setModel(oModel, "monthlyPO");

        // ✅ Add feeds
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: ["Tháng"],
          })
        );
        oVizFrame.addFeed(
          new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: ["Số lượng PO"],
          })
        );

        oVizFrame.setVizType("column");

        oVizFrame.setVizProperties({
          title: {
            text:
              aChartData.length > 0 && aChartData[0].Month.startsWith("Năm")
                ? "Số lượng PO theo năm"
                : "Số lượng PO theo tháng",
            alignment: "center",
            visible: true,
          },
          plotArea: {
            colorPalette: ["#4CAF50"],
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
            return "Hôm nay";
          case "thisWeek":
            return "Tuần này";
          case "thisMonth":
            return "Tháng " + (now.getMonth() + 1);
          case "thisQuarter":
            return "Quý " + (Math.floor(now.getMonth() / 3) + 1);
          case "thisYear":
            return "Năm " + now.getFullYear();
          case "thisAll":
            return "Toàn bộ thời gian";
          default:
            return "";
        }
      },

      onPoTypeChange: function (oEvent) {
        const sKey = oEvent.getSource().getSelectedKey();
        this._currentPoType = sKey; // Lưu lại loại chọn hiện tại (F hoặc A)
        const sPeriodKey =
          this.byId("timeFilter").getSelectedKey() || "thisYear";

        // 🔁 Gọi lại hàm load biểu đồ PO với loại mới
        this._loadMonthlyPoBarChart(sPeriodKey);
      },

      onGoToPRList: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("PRList");
      },
    });
  }
);
