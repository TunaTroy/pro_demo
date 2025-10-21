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

    _getKpiTypes: function () {
      return [
        { key: "PR", title: "Purchase Requisition", vizId: "idPRChart", entity: "/PRsSet", fieldId: "Banfn" }
      ];
    },



onInit: function () {
  this.oOData = this.getOwnerComponent().getModel();
  // Chỉ load KPI và chart ban đầu
  this._reloadKpiAndChart("thisMonth");
  this._loadBarChartCard();

},

onTimeFilterChange: function (oEvent) {
  var sKey = oEvent.getSource().getSelectedKey();
  this._reloadKpiAndChart(sKey);
},




_reloadKpiAndChart: function (sPeriodKey) {
  const oType = { key: "PR", title: "Purchase Requisition", vizId: "idPRChart", entity: "/PRsSet", fieldId: "Banfn" };
  BusyIndicator.show(0);

  Promise.all([
    this._loadKpiPurchaseRequisition(oType, sPeriodKey),
    this._loadStatusDonutChart(oType, sPeriodKey)
  ]).finally(() => {
    BusyIndicator.hide();
  });
},



    /* ===== Load KPI theo loại ===== */
    _loadKpiGeneric: function (oType, sPeriodKey) {
      return new Promise((resolve) => {
        if (oType.key === "PR") {
          this._loadKpiPurchaseRequisition(oType, sPeriodKey, resolve);
        } else {
          this._loadKpiMock(oType, sPeriodKey, resolve);
        }
      });
    },

 
    /* ===== Load KPI PR thật (sử dụng aCurr / aPrev đúng cách) ===== */
_loadKpiPurchaseRequisition: function (oType, sPeriodKey, resolve) {
  var oCurrRange = this._getDateRange(sPeriodKey);
  var oPrevRange = this._getPreviousRange(sPeriodKey);

  this.oOData.read("/PRsSet", {
    urlParameters: { "$select": "Banfn,Badat", "$top": "500" },
    success: function (oData) {
      var results = oData.results || [];

      // Normalize các trường ngày (nếu server trả kiểu "/Date(....)/")
      this._normalizeDateFields(results, "Badat");

      // Lọc với so sánh bằng timestamp để tránh so sánh string/Date lẫn lộn
      var aCurr = results.filter(function (r) {
        if (!r.Badat) return false;
        var t = (r.Badat instanceof Date) ? r.Badat.getTime() : new Date(r.Badat).getTime();
        return t >= oCurrRange.start.getTime() && t <= oCurrRange.end.getTime();
      });

      var aPrev = results.filter(function (r) {
        if (!r.Badat) return false;
        var t = (r.Badat instanceof Date) ? r.Badat.getTime() : new Date(r.Badat).getTime();
        return t >= oPrevRange.start.getTime() && t <= oPrevRange.end.getTime();
      });

      // Bây giờ dùng aCurr và aPrev để tính KPI
      var iCurrCount = this._countUniqueBanfn(aCurr);
      var iPrevCount = this._countUniqueBanfn(aPrev);

      this._displayKpiCard(sPeriodKey, iCurrCount, iPrevCount, oType);
      if (typeof resolve === "function") resolve();
    }.bind(this),

    error: function (e) {
      console.error("❌ OData Read error:", e);
      MessageToast.show("Lỗi khi tải dữ liệu KPI");
      this._displayKpiCard(sPeriodKey, 0, 0, oType);
      if (typeof resolve === "function") resolve();
    }.bind(this)
  });
},

_updateStaticKpiCard: function (iCurrCount, iPrevCount, sPeriodKey, oType) {
  const fPercent = (iPrevCount === 0)
    ? (iCurrCount > 0 ? 100 : 0)
    : ((iCurrCount - iPrevCount) / iPrevCount * 100);

  const sState = fPercent >= 0 ? "Success" : "Error";
  const sPercentText = (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%";

  // Cập nhật trực tiếp các field trong view
  const oView = this.getView();
  oView.byId("_IDGenText1").setText(oType.title);  // title
  oView.byId("_IDGenText").setText(this._getPeriodLabel(sPeriodKey)); // subtitle
  oView.byId("_IDGenText2").setText(iCurrCount.toLocaleString()); // value
  oView.byId("_IDGenText3").setText(sPercentText).setState(sState); // % tăng giảm
  oView.byId("_IDGenProgressIndicator").setPercentValue(Math.min(Math.abs(Math.round(fPercent)), 100))
                                      .setDisplayValue(Math.abs(fPercent).toFixed(0) + "%")
                                      .setState(sState);
},



    /* ===== Normalize field date dạng /Date(x)/ thành Date object ===== */
    _normalizeDateFields: function (aResults, sField) {
      aResults.forEach(r => {
        const v = r[sField];
        if (typeof v === "string") {
          const m = /Date\((\d+)\)/.exec(v);
          if (m) r[sField] = new Date(parseInt(m[1], 10));
        }
      });
    },






    /* ===== Load Donut Chart PR ===== */
    _loadStatusDonutChart: function (oType, sPeriodKey, resolve) {
  const oCurrRange = this._getDateRange(sPeriodKey);

  this.oOData.read("/PRsSet", {
    urlParameters: { "$select": "Banfn,Badat,Frgkz", "$top": "500" },
    success: (oData) => {
      const results = oData.results || [];
      this._normalizeDateFields(results, "Badat");

      // Lọc trong khoảng thời gian
      const aCurr = results.filter(r => r.Badat >= oCurrRange.start && r.Badat <= oCurrRange.end);

      // Đếm theo trạng thái thực tế
      let iApproved = 0, iPending = 0, iRejected = 0;
      aCurr.forEach(r => {
        if (r.Frgkz === "R") iApproved++;
        else if (r.Frgkz === "C") iPending++;
        else if (r.Frgkz === "X") iRejected++;
      });

      // Tạo dữ liệu thật
      const aChartData = [
        { Status: "Approved", Count: iApproved },
        { Status: "Pending", Count: iPending },
        { Status: "Rejected", Count: iRejected }
      ];

      this._displayStatusDonutChart(aChartData, oType);
      if (resolve) resolve();
    },
    error: (e) => {
      console.error("❌ OData Read error:", e);
      MessageToast.show("Lỗi khi tải dữ liệu Chart");
      this._displayStatusDonutChart([
        { Status: "Approved", Count: 0 },
        { Status: "Pending", Count: 0 },
        { Status: "Rejected", Count: 0 }
      ], oType);
      if (resolve) resolve();
    }
  });
},


/* ===== Load Bar Chart Card (data ảo) ===== */
_loadBarChartCard: function () {
  const oData = {
    title: "Purchase Orderdsfsdfsfsdfsdfsfsfsfssdfsdfsf",

    chartData: [
      { label: "Bia HN", value: 120 },
      { label: "Bia SG", value: 90 },
      { label: "Bia Bot", value: 60 }
    ]
  };

  const oModel = new sap.ui.model.json.JSONModel(oData);
  const oVBox = this.byId("kpiContainer");

  sap.ui.core.Fragment.load({
    name: "demodashboard.fragment.KpiBarChart",
    controller: this
  }).then(oFrag => {
    oFrag.setModel(oModel, "kpi");
    oVBox.addItem(oFrag);

    // ✅ Cấu hình biểu đồ hiển thị kiểu bar chart (dọc)
    const oVizFrame = oFrag.byId("idBarChart");
    oVizFrame.setVizType("column");

    oVizFrame.setVizProperties({
      title: { visible: false },
      legend: { visible: true, position: "bottom" },
      plotArea: {
        dataLabel: { visible: true, formatString: "0" },
        colorPalette: ["#28A745", "#FFC107", "#DC3545"]
      },
      valueAxis: {
        title: { visible: false }
      },
      categoryAxis: {
        title: { visible: false }
      }
    });
  });
},




    /* ===== Hiển thị KPI Card ===== */
_displayKpiCard: function (sPeriodKey, iCurrCount, iPrevCount, oType) {
  const fPercent = (iPrevCount === 0)
    ? (iCurrCount > 0 ? 100 : 0)
    : ((iCurrCount - iPrevCount) / iPrevCount * 100);

  const oKpi = {
    title: oType.title,
    period: this._getPeriodLabel(sPeriodKey),
    value: iCurrCount.toLocaleString(),
    percentage: (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%",
    progress: Math.min(Math.abs(Math.round(fPercent)), 100),
    state: fPercent >= 0 ? "Success" : "Error"
  };

  // 🔹 Cập nhật model thật cho KPI card
  const oKpiModel = new JSONModel(oKpi);
  this.getView().setModel(oKpiModel, "kpiModel");
},


    /* ===== Hiển thị Donut Chart ===== */
    _displayStatusDonutChart: function (aChartData, oType) {
  const oVizFrame = this.getView().byId(oType.vizId);
  if (!oVizFrame) return;

  oVizFrame.destroyFeeds();
  oVizFrame.destroyDataset();

  const oChartModel = new JSONModel({ items: aChartData });
  const oDataset = new FlattenedDataset({
    dimensions: [{ name: "Status", value: "{chart>Status}" }],
    measures: [{ name: "Count", value: "{chart>Count}" }],
    data: { path: "chart>/items" }
  });

  oVizFrame.setDataset(oDataset);
  oVizFrame.setModel(oChartModel, "chart");

  oVizFrame.addFeed(new FeedItem({
    uid: "size",
    type: "Measure",
    values: ["Count"]
  }));
  oVizFrame.addFeed(new FeedItem({
    uid: "color",
    type: "Dimension",
    values: ["Status"]
  }));

  oVizFrame.setVizType("donut");
  oVizFrame.setVizProperties({
    title: { visible: false },
    legend: { visible: true, position: "right" },
    plotArea: {
      dataLabel: {
        visible: true,
        showTotal: true,
        type: "value", // hiển thị giá trị thật
        formatString: "0" // số nguyên
      },
      colorPalette: ["#28A745", "#FFC107", "#DC3545"] // xanh, vàng, đỏ
    },
    interaction: { selectability: "single" },
    tooltip: {
      visible: true,
      formatString: ["#,##0"]
    }
  });
},


    

    /* ===== Tạo KPI Card Fragment ===== */
    _addKpiCard: function (oData) {
  const oHBox = this.getView().byId("kpiContainer");
  if (!oHBox) return;

  const sFragId = this.getView().createId("kpiFragment_" + oData.title.replace(/\s+/g, ""));
  if (sap.ui.getCore().byId(sFragId)) {
    // Nếu fragment đã có -> chỉ update model
    sap.ui.getCore().byId(sFragId).getModel().setData(oData);
    return;
  }

  Fragment.load({
    id: sFragId,
    name: "demodashboard.fragment.Kpi",
    controller: this
  }).then((oFrag) => {
    oFrag.setModel(new JSONModel(oData));
    oHBox.addItem(oFrag);
  });
},

    /* ===== Helpers ===== */
    _countUniqueBanfn: function (aRows) {
      return new Set(aRows.map(r => r.Banfn)).size;
    },

    _getDateRange: function (key) {
      const now = new Date();
      let start, end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      switch (key) {
        case "today": start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); break;
        case "thisWeek": start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0); break;
        case "thisMonth": start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); break;
        case "thisQuarter":
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0); break;
        case "thisYear": start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0); break;
        default: start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
      return { start, end };
    },

    _getPreviousRange: function (key) {
      const now = new Date();
      let start, end;
      switch (key) {
        case "today":
          const y = new Date(now); y.setDate(now.getDate() - 1);
          start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
          end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
          break;
        case "thisWeek":
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
          end = new Date(start); end.setDate(start.getDate() + 6);
          break;
        case "thisMonth":
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case "thisQuarter":
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), (q - 1) * 3, 1);
          end = new Date(now.getFullYear(), q * 3, 0);
          break;
        case "thisYear":
          start = new Date(now.getFullYear() - 1, 0, 1);
          end = new Date(now.getFullYear() - 1, 11, 31);
          break;
      }
      return { start, end };
    },

    _getPeriodLabel: function (key) {
      const now = new Date();
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
