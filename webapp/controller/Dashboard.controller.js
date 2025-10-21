sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/ui/core/BusyIndicator",
  "sap/m/MessageToast",
  "sap/viz/ui5/controls/common/feeds/FeedItem",
  "sap/viz/ui5/data/FlattenedDataset"
], function (Controller, JSONModel, Fragment, BusyIndicator, MessageToast, FeedItem, FlattenedDataset) {
  "use strict";

  return Controller.extend("demodashboard.controller.Dashboard", {

    onInit: function () {
      this.oOData = this.getOwnerComponent().getModel(); // OData model
      this._reloadAll("thisMonth");
    },

    onTimeFilterChange: function (oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      this._reloadAll(sKey);
    },

    /* ===== Tải toàn bộ dashboard ===== */
    _reloadAll: function (sPeriodKey) { 
      var oHBox = this.getView().byId("kpiContainer");
      if (oHBox) {
        oHBox.removeAllItems();
      }

      

      // Không cần chartContainer nữa vì VizFrame hiển thị trực tiếp
      this._loadKpiPurchaseRequisition(sPeriodKey);
      this._loadStatusDonutChart(sPeriodKey);
      this._loadTopMaterialBarChart(sPeriodKey);
      
    },

    /* ===== Load KPI ===== */
    _loadKpiPurchaseRequisition: function (sPeriodKey) {
      BusyIndicator.show(0);
      var oCurrRange = this._getDateRange(sPeriodKey);
      var oPrevRange = this._getPreviousRange(sPeriodKey);

      this.oOData.read("/PRsSet", {
        urlParameters: {
          "$select": "Banfn,Badat",
          "$top": "500"
        },
        success: function (oData) {
          BusyIndicator.hide();

          if (!oData.results || oData.results.length === 0) {
            MessageToast.show("Không có dữ liệu Purchase Requisition");
            this._displayKpiCard(sPeriodKey, 0, 0);
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
            return r.Badat && r.Badat >= oCurrRange.start && r.Badat <= oCurrRange.end;
          });
          var aPrev = oData.results.filter(function (r) {
            return r.Badat && r.Badat >= oPrevRange.start && r.Badat <= oPrevRange.end;
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
        }.bind(this)
      });
    },

    /* ===== Load Status Donut Chart ===== */
    _loadStatusDonutChart: function (sPeriodKey) {
      BusyIndicator.show(0);
      var oCurrRange = this._getDateRange(sPeriodKey);

      this.oOData.read("/PRsSet", {
        urlParameters: {
          "$select": "Banfn,Badat,Frgkz",
          "$top": "500"
        },
        success: function (oData) {
          BusyIndicator.hide();

          if (!oData.results || oData.results.length === 0) {
            MessageToast.show("Không có dữ liệu Status");
            this._displayStatusDonutChart([
              { Status: "Approved", Count: 0 },
              { Status: "Pending", Count: 0 },
              { Status: "Rejected", Count: 0 }
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
            return r.Badat && r.Badat >= oCurrRange.start && r.Badat <= oCurrRange.end;
          });

          // Đếm trạng thái: R=Approved, C=Pending, X=Rejected
          var iApproved = 0, iPending = 0, iRejected = 0;
          aCurr.forEach(function (r) {
            if (r.Frgkz === "R") iApproved++;
            else if (r.Frgkz === "C") iPending++;
            else if (r.Frgkz === "X") iRejected++;
          });

          var aChartData = [
            { Status: "Approved", Count: iApproved },
            { Status: "Pending", Count: iPending },
            { Status: "Rejected", Count: iRejected }
          ].filter(function (item) { return item.Count > 0; });

          if (aChartData.length === 0) {
            aChartData = [{ Status: "No Data", Count: 1 }];
          }

          this._displayStatusDonutChart(aChartData);

        }.bind(this),

        error: function (e) {
          BusyIndicator.hide();
          MessageToast.show("Lỗi khi tải dữ liệu Status");
          this._displayStatusDonutChart([{ Status: "No Data", Count: 1 }]);
        }.bind(this)
      });
    },

/* ===== Load Bar Chart: Top Material ===== */
_loadTopMaterialBarChart: function (sPeriodKey) {
  BusyIndicator.show(0);
  var oCurrRange = this._getDateRange(sPeriodKey);

  this.oOData.read("/PRsSet", {
    urlParameters: {
      "$select": "Banfn,Badat,Txz01",
      "$top": "1000"
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
        return r.Badat && r.Badat >= oCurrRange.start && r.Badat <= oCurrRange.end;
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
    }.bind(this)
  });
},





    /* ===== Hiển thị KPI Card ===== */
    _displayKpiCard: function (sPeriodKey, iCurrCount, iPrevCount) {
      var fPercent = (iPrevCount === 0)
        ? (iCurrCount > 0 ? 100 : 0)
        : ((iCurrCount - iPrevCount) / iPrevCount * 100);

      var oKpi = {
        title: "Purchase Requisition",
        period: this._getPeriodLabel(sPeriodKey),
        value: iCurrCount.toLocaleString(),
        percentage: (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%",
        progress: Math.min(Math.abs(Math.round(fPercent)), 100),
        state: fPercent >= 0 ? "Success" : "Error"
      };

      this._addKpiCard(oKpi);
    },

    /* ===== Hiển thị Donut Chart ===== */
    _displayStatusDonutChart: function (aChartData) {
      var oVizFrame = this.getView().byId("idDonutChart");
      if (!oVizFrame) {
        console.error("❌ Không tìm thấy Donut Chart VizFrame!");
        return;
      }

      oVizFrame.destroyFeeds();
      oVizFrame.destroyDataset();

      var oChartModel = new JSONModel({ items: aChartData });
      this.getView().setModel(oChartModel, "chart");

      var oDataset = new FlattenedDataset({
        dimensions: [{ name: "Status", value: "{chart>Status}" }],
        measures: [{ name: "Count", value: "{chart>Count}" }],
        data: { path: "chart>/items" }
      });

      oVizFrame.setDataset(oDataset);
      oVizFrame.setModel(oChartModel, "chart");

      oVizFrame.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["Count"] }));
      oVizFrame.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Status"] }));

      oVizFrame.setVizProperties({
        title: { text: "PR Status Overview" },
        plotArea: {
          colorPalette: ["#2e7d32", "#f9a825", "#c62828"], // Approved, Pending, Rejected
          dataLabel: { visible: true }
        },
        legend: { visible: true, position: "bottom" },
        tooltip: { visible: true }
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
    data: { path: "topMaterial>/items" }
  });

  oVizFrame.setDataset(oDataset);
  oVizFrame.setModel(oModel, "topMaterial");

  oVizFrame.addFeed(new FeedItem({
    uid: "valueAxis",
    type: "Measure",
    values: ["Count"]
  }));
  oVizFrame.addFeed(new FeedItem({
    uid: "categoryAxis",
    type: "Dimension",
    values: ["Material"]
  }));

  oVizFrame.setVizProperties({
  title: {
    text: "Top 5 Best Material",
    visible: true,
    alignment: "center" // 👈 THÊM DÒNG NÀY
  },
  plotArea: {
    colorPalette: ["#5CBAE6"],
    dataLabel: { visible: true }
  },
  legend: { visible: false },
  tooltip: { visible: true }
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
        controller: this
      }).then(function (oFrag) {
        var oModel = new JSONModel(oData);
        oFrag.setModel(oModel);
        oHBox.addItem(oFrag);
      }.bind(this)).catch(function (err) {
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
      var start, end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      switch (key) {
        case "today": start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); break;
        case "thisWeek": start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0); break;
        case "thisMonth": start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); break;
        case "thisQuarter":
          var q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
          break;
        case "thisYear": start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0); break;
        default: start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
      return { start: start, end: end };
    },

    _getPreviousRange: function (key) {
      var now = new Date();
      var start, end;

      switch (key) {
        case "today":
          var y = new Date(now); y.setDate(now.getDate() - 1);
          start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
          end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
          break;
        case "thisWeek":
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7, 0, 0, 0, 0);
          end = new Date(start); end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "thisMonth":
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
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
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }
      return { start: start, end: end };
    },

    _getPeriodLabel: function (key) {
      var now = new Date();
      switch (key) {
        case "today": return "Hôm nay";
        case "thisWeek": return "Tuần này";
        case "thisMonth": return "Tháng " + (now.getMonth() + 1);
        case "thisQuarter": return "Quý " + (Math.floor(now.getMonth() / 3) + 1);
        case "thisYear": return "Năm " + now.getFullYear();
        default: return "";
      }
    },

    onGoToPRList: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("PRList");
    }
  });
});