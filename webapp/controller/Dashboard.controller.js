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

    // Config cho 6 types MM (entity/field cho OData nếu có, vizId cho chart ID)
    _getKpiTypes: function () {
      return [
        { key: "PR", title: "Purchase Requisition", vizId: "idPRChart", entity: "/PRsSet", fieldId: "Banfn" },
        { key: "RFQ", title: "RFQ", vizId: "chartRFQ", entity: "/RFQsSet", fieldId: "Rfqno" }, // Mock nếu entity không tồn tại
        { key: "Quotation", title: "Quotation", vizId: "chartQuotation", entity: "/QuotationsSet", fieldId: "Quotno" },
        { key: "PO", title: "Purchase Order", vizId: "chartPO", entity: "/POsSet", fieldId: "Ebeln" },
        { key: "GR", title: "Goods Receipt", vizId: "chartGR", entity: "/GRsSet", fieldId: "Mblnr" },
        { key: "Invoice", title: "Invoice", vizId: "chartInvoice", entity: "/InvoicesSet", fieldId: "Belnr" }

      ];
    },

    onInit: function () {
      this.oOData = this.getOwnerComponent().getModel(); // OData model
      this._reloadAll("thisMonth");
    },

    onTimeFilterChange: function (oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      this._reloadAll(sKey);
    },

    /* ===== Tải toàn bộ dashboard ===== */
    // _reloadAll: function (sPeriodKey) {
    //   BusyIndicator.show(0);
    //   var oHBox = this.getView().byId("kpiContainer");
    //   if (oHBox) {
    //     oHBox.removeAllItems();
    //   }

    //   var aTypes = this._getKpiTypes();
    //   // Loop parallel cho 6 types: Load KPI + Chart cho từng type
    //   Promise.all(aTypes.map(function (oType) {
    //     return Promise.all([
    //       this._loadKpiGeneric(oType, sPeriodKey),
    //       this._loadStatusDonutGeneric(oType, sPeriodKey)
    //     ]);
    //   }.bind(this))).finally(function () {
    //     BusyIndicator.hide();
    //   });
    // },

_reloadAll: async function (sPeriodKey) {
  BusyIndicator.show(0);
  var oHBox = this.getView().byId("kpiContainer");
  if (oHBox) oHBox.removeAllItems();

  var aTypes = this._getKpiTypes();

  for (const oType of aTypes) {
    try {
      await this._loadKpiGeneric(oType, sPeriodKey);
      await this._loadStatusDonutGeneric(oType, sPeriodKey);
    } catch (err) {
      console.error("Error loading KPI:", oType.key, err);
    }
  }

  BusyIndicator.hide();
},




    /* ===== Load KPI Generic (OData cho PR, mock cho others) ===== */
    _loadKpiGeneric: function (oType, sPeriodKey) {
      return new Promise(function (resolve, reject) {
        if (oType.key === "PR") {
          // OData real cho PR (giữ logic cũ)
          this._loadKpiPurchaseRequisition(oType, sPeriodKey, resolve, reject);
        } else {
          // Mock cho others (scale theo period)
          this._loadKpiMock(oType, sPeriodKey, resolve, reject);
        }
      }.bind(this));
    },

    /* ===== OData PR KPI (tái sử dụng logic cũ, callback resolve) ===== */
    _loadKpiPurchaseRequisition: function (oType, sPeriodKey, resolve, reject) {
      var oCurrRange = this._getDateRange(sPeriodKey);
      var oPrevRange = this._getPreviousRange(sPeriodKey);

      this.oOData.read("/PRsSet", {
        urlParameters: {
          "$select": "Banfn,Badat",
          "$top": "500"
        },
        success: function (oData) {
          if (!oData.results || oData.results.length === 0) {
            this._displayKpiCard(sPeriodKey, 0, 0, oType);
            resolve();
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

          this._displayKpiCard(sPeriodKey, iCurrCount, iPrevCount, oType);
          resolve();
        }.bind(this),

        error: function (e) {
          console.error("❌ OData Read error:", e);
          MessageToast.show("Lỗi khi tải dữ liệu KPI");
          this._displayKpiCard(sPeriodKey, 0, 0, oType);
          resolve(); // Không reject để không block others
        }.bind(this)
      });
    },

    /* ===== Mock KPI cho other types ===== */
    _loadKpiMock: function (oType, sPeriodKey, resolve, reject) {
      // Scale theo period (e.g., thisYear lớn hơn)
      var mScale = { today: 0.1, thisWeek: 0.3, thisMonth: 0.6, thisQuarter: 0.8, thisYear: 1.0 };
      var scale = mScale[sPeriodKey] || 0.6;
      var iBaseCurr = Math.round(125 * scale); // Base 125 (K), scale theo filter
      var iBasePrev = Math.round(iBaseCurr * 0.8); // Previous 80%
      var fPercent = iBasePrev === 0 ? (iBaseCurr > 0 ? 100 : 0) : ((iBaseCurr - iBasePrev) / iBasePrev * 100);

      this._displayKpiCard(sPeriodKey, iBaseCurr, iBasePrev, oType);
      resolve();
    },

    /* ===== Load Status Donut Generic (OData cho PR, mock cho others) ===== */
    _loadStatusDonutGeneric: function (oType, sPeriodKey) {
      return new Promise(function (resolve, reject) {
        if (oType.key === "PR") {
          // OData real cho PR (giữ logic cũ)
          this._loadStatusDonutChart(oType, sPeriodKey, resolve, reject);
        } else {
          // Mock cho others
          this._loadStatusDonutMock(oType, sPeriodKey, resolve, reject);
        }
      }.bind(this));
    },

    /* ===== OData PR Chart (callback resolve) ===== */
/* ===== OData PR Chart (callback resolve) ===== */
_loadStatusDonutChart: function (oType, sPeriodKey, resolve, reject) {
  var oCurrRange = this._getDateRange(sPeriodKey);

  this.oOData.read("/PRsSet", {
    urlParameters: {
      "$select": "Banfn,Badat,Frgkz",
      "$top": "500"
    },
    success: function (oData) {
      if (!oData.results || oData.results.length === 0) {
        // Force 3 statuses với 0 nếu no data
        var aChartData = [
          { Status: "A", Count: 0 },
          { Status: "P", Count: 0 },
          { Status: "R", Count: 0 }
        ];
        this._displayStatusDonutChart(aChartData, oType);
        resolve();
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

      // Đếm trạng thái
      var iApproved = 0, iPending = 0, iRejected = 0;
      aCurr.forEach(function (r) {
        if (r.Frgkz === "R") iApproved++;
        else if (r.Frgkz === "C") iPending++;
        else if (r.Frgkz === "X") iRejected++;
      });

      // Force 3 statuses (bỏ filter, luôn include dù Count=0)
      var aChartData = [
        { Status: "A", Count: iApproved },
        { Status: "P", Count: iPending },
        { Status: "R", Count: iRejected }
      ];

      this._displayStatusDonutChart(aChartData, oType);
      resolve();
    }.bind(this),

    error: function (e) {
      console.error("❌ OData Read error:", e);
      MessageToast.show("Lỗi khi tải dữ liệu Status");
      // Force 3 statuses với 0 nếu error
      var aChartData = [
        { Status: "A", Count: 0 },
        { Status: "P", Count: 0 },
        { Status: "R", Count: 0 }
      ];
      this._displayStatusDonutChart(aChartData, oType);
      resolve();
    }.bind(this)
  });
},

    /* ===== Mock Chart cho other types ===== */
_loadStatusDonutMock: function (oType, sPeriodKey, resolve, reject) {
  var mScale = { today: 0.1, thisWeek: 0.3, thisMonth: 0.6, thisQuarter: 0.8, thisYear: 1.0 };
  var scale = mScale[sPeriodKey] || 0.6;
  var mStatusBase = {
    RFQ: [40, 40, 20], Quotation: [35, 45, 20], PO: [50, 30, 20],
    GR: [60, 25, 15], Invoice: [45, 35, 20]
  };
  var aBase = mStatusBase[oType.key] || [40, 35, 25];
  var aCounts = aBase.map(function (pct) { return Math.round(pct * scale); });

  // Force 3 statuses (bỏ filter, luôn include dù Count=0)
  var aChartData = [
    { Status: "A", Count: aCounts[0] },
    { Status: "P", Count: aCounts[1] },
    { Status: "R", Count: aCounts[2] }
  ];

  this._displayStatusDonutChart(aChartData, oType);
  resolve();
},

    /* ===== Hiển thị KPI Card (thêm oType cho title) ===== */
    _displayKpiCard: function (sPeriodKey, iCurrCount, iPrevCount, oType) {
      var fPercent = (iPrevCount === 0)
        ? (iCurrCount > 0 ? 100 : 0)
        : ((iCurrCount - iPrevCount) / iPrevCount * 100);

      var oKpi = {
        title: oType.title,
        period: this._getPeriodLabel(sPeriodKey),
        value: iCurrCount.toLocaleString(),
        percentage: (fPercent >= 0 ? "+" : "") + fPercent.toFixed(1) + "%",
        progress: Math.min(Math.abs(Math.round(fPercent)), 100),
        state: fPercent >= 0 ? "Success" : "Error"
      };

      this._addKpiCard(oKpi);
    },

    /* ===== Hiển thị Donut Chart (thêm oType cho vizId và title) ===== */
_displayStatusDonutChart: function (aChartData, oType) {
  var oVizFrame = this.getView().byId(oType.vizId);
  if (!oVizFrame) {
    console.error("❌ Không tìm thấy VizFrame ID:", oType.vizId);
    return;
  }

  oVizFrame.destroyFeeds();
  oVizFrame.destroyDataset();

  var oChartModel = new JSONModel({ items: aChartData });
  oVizFrame.setModel(oChartModel, "chart");

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
    title: { text: "" }, // Bỏ title viz nếu đã có XML title
    plotArea: {
      colorPalette: ["#233549", "#556B81", "#427CAC"], // Approved, Pending, Rejected
      dataLabel: { 
        visible: true,
        type: "value", // Đổi từ "percentage" sang "value" để hiển thị số lượng (Count)
        position: "outside", // Ngoài slice để dễ đọc
        font: {
          size: "10px" // Font nhỏ để fit
        },
        autoPosition: true // Tự adjust nếu overlap
      }
    },
    legend: { 
      visible: true, 
      position: "bottom",
      maxStaticItemLength: 20 // Giới hạn text legend
    },
    tooltip: { visible: true } // Tooltip vẫn có % và chi tiết khi hover
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
         //id: this.getView().getId() + "_kpiFragment_" + Date.now(),
         id: this.getView().createId("kpiFragment_" + oData.title.replace(/\s+/g, "") + Date.now()),

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