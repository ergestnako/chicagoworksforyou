// JQUERY

$(function () {
    $('.pagination-wrap').affix({
        offset: {top: $('.pagination').position().top}
    });
});

// ANGULAR

var serviceApp = angular.module('serviceApp', []).value('$anchorScroll', angular.noop);

serviceApp.factory('Data', function () {
    return {};
});

serviceApp.config(function($routeProvider) {
    $routeProvider.
        when('/', {
            controller: "serviceCtrl",
            templateUrl: "/views/service_chart.html"
        }).
        when('/:date', {
            controller: "serviceCtrl",
            templateUrl: "/views/service_chart.html"
        }).
        otherwise({
            redirectTo: '/'
        });
});

serviceApp.controller("sidebarCtrl", function ($scope, Data, $http, $location) {
    $scope.data = Data;

    $scope.goToPrevDate = function() {
        if (Data.prevWeek.day(0).isBefore(window.earliestDate)) {
            return false;
        }
        $location.path(Data.prevWeek.format(dateFormat));
    };

    $scope.goToNextDate = function() {
        if (Data.nextWeek.day(0).isAfter(window.yesterday)) {
            return false;
        }
        $location.path(Data.nextWeek.format(dateFormat));
    };

});

serviceApp.controller("serviceCtrl", function ($scope, Data, $http, $location, $routeParams) {
    var date = parseDate($routeParams.date, window.prevSaturday, $location);
    var startDate = moment(date).day(0);
    var endDate = moment(date).day(6).max(window.yesterday);
    var duration = endDate.diff(startDate, 'days');

    Data.prevWeek = moment(startDate).subtract('day',1);
    Data.nextWeek = moment(endDate).add('day',7);
    Data.thisDate = moment.duration(duration,"days").beforeMoment(endDate,true).format({implicitYear: false});

    $scope.data = Data;

    var stCode = window.currServiceType;
    var stSlug = window.lookupCode(stCode).slug;
    var url = window.apiDomain + 'requests/' + stCode + '/counts.json?end_date=' + endDate.format(dateFormat) + '&count=' + (duration + 1) + '&callback=JSON_CALLBACK';
    var chart = $('#chart').highcharts();

    $http.jsonp(url).
        success(function(response, status, headers, config) {
            Data.cityCount = response.CityData.Count;
            Data.cityAverage = response.CityData.Count / 50;
            var wardData = response.WardData;
            var categories = _.map(_.keys(wardData), function (wardNum) { return '<a href="/ward/' + wardNum + '/#/' + endDate.format(dateFormat) + '/' + stSlug + '">Ward ' + wardNum + '</a>'; });
            var days = [[],[],[],[],[],[],[]];
            for (var ward in wardData) {
                var i = 0;
                for (var count in wardData[ward].Counts) {
                    days[i++].push(wardData[ward].Counts[count]);
                }
            }

            var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            var series = [];
            for (var day in days) {
                if (days[day].length > 0) {
                    series.push({
                        name: weekdays[day],
                        data: days[day],
                        stack: 0,
                        legendIndex: day + 1
                    });
                }
            }

            new Highcharts.Chart({
                chart: {
                    renderTo: 'chart'
                },
                colors: [
                    '#37c0b9',
                    '#37acc3',
                    '#3790c7',
                    '#3973c9',
                    '#3a56ca',
                    '#403ccc',
                    '#603fce'
                ].reverse(),
                series: series.reverse(),
                xAxis: {
                    categories: categories
                },
                yAxis: {
                    opposite: true,
                    plotLines: [{
                        id: 'avg',
                        value: Data.cityAverage,
                        color: 'black',
                        width: 3,
                        zIndex: 5
                    }]
                }
            });
        }
    );
});

// HIGHCHARTS

Highcharts.setOptions({
    chart: {
        marginBottom: 40,
        type: 'bar'
    },
    title: {
        text: ''
    },
    xAxis: {
        tickmarkPlacement: 'between',
        labels: {
            style: {
                fontFamily: 'Monda, Helvetica, sans-serif',
                fontSize: '13px'
            },
            y: 5
        }
    },
    yAxis: {
        title: {
            text: ''
        },
        minPadding: 0.1,
        labels: {
            style: {
                fontFamily: 'Monda, Helvetica, sans-serif',
                fontWeight: 'bold'
            }
        }
    },
    plotOptions: {
        bar: {
            borderWidth: 0,
            groupPadding: 0.08,
            dataLabels: {
                enabled: false,
                color: "#000000",
                style: {
                    fontFamily: "Monda, Helvetica, sans-serif",
                    fontSize: '13px',
                    fontWeight: 'bold'
                }
            },
            pointPadding: 0,
            stacking: 'normal'
        }
    },
    tooltip: {
        headerFormat: '',
        // pointFormat: '<b>{point.y:,.0f}</b> requests',
        shadow: false,
        style: {
            fontFamily: 'Monda, Helvetica, sans-serif',
            fontSize: '15px'
        },
        formatter: function() {
            return this.series.name + ': <b>' + this.y + '</b>';
        }
    },
    legend: {
        enabled: true,
        borderWidth: 0,
        backgroundColor: "#f7f7f7",
        padding: 10,
        verticalAlign: 'top',
        y: 10
    }
});
