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

    $scope.prevDay = function () {
        $location.path(Data.prevDay);
    };

    $scope.nextDay = function () {
        $location.path(Data.nextDay);
    };
});

serviceApp.controller("serviceCtrl", function ($scope, Data, $http, $location, $routeParams) {
    var date = parseDate($routeParams.date, window.prevSaturday, $location, '');

    Data.dateFormatted = date.format(dateFormat);
    Data.prevDay = moment(date).subtract('day',1).format(dateFormat);
    Data.nextDay = moment(date).add('day',1).format(dateFormat);
    Data.thisMonth = monthDuration.beforeMoment(date,true).format({implicitYear: false});

    $scope.data = Data;

    var stCode = window.currServiceType;
    var stSlug = window.lookupCode(stCode).slug;
    var numOfDays = 28;
    var url = window.apiDomain + 'requests/' + stCode + '/counts.json?end_date=' + Data.dateFormatted + '&count=' + numOfDays + '&callback=JSON_CALLBACK';
    var chart = $('#chart').highcharts();

    $http.jsonp(url).
        success(function(response, status, headers, config) {
            var cityAverage = response['0'].Count / 50;
            var counts = _.rest(_.pluck(response, 'Count'));
            var categories = _.map(_.rest(_.keys(response)), function (wardNum) { return '<a href="/ward/' + wardNum + '/#/' + stSlug + '">Ward ' + wardNum + '</a>'; });

            new Highcharts.Chart({
                chart: {
                    renderTo: 'chart'
                },
                series: [{
                    data: counts,
                    id: 'counts',
                    index: 1,
                    dataLabels: {
                        style: {
                            fontWeight: 'bold'
                        }
                    }
                }],
                xAxis: {
                    categories: categories
                },
                yAxis: {
                    plotLines: [{
                        id: 'avg',
                        value: cityAverage,
                        color: 'brown',
                        width: 3,
                        zIndex:5
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
                fontFamily: 'Monda, sans-serif',
                fontSize: '13px'
            }
        }
    },
    yAxis: {
        title: {
            text: ''
        },
        minPadding: 0.1,
        labels: {
            style: {
                fontFamily: 'Monda, sans-serif',
                fontWeight: 'bold'
            }
        }
    },
    plotOptions: {
        bar: {
            borderWidth: 0,
            groupPadding: 0.08,
            dataLabels: {
                enabled: true,
                color: "#000000",
                style: {
                    fontFamily: "Monda, sans-serif",
                    fontSize: '13px'
                }
            },
            pointPadding: 0
        }
    },
    tooltip: {
        headerFormat: '',
        pointFormat: '<b>{point.y:,.0f}</b> requests',
        shadow: false,
        style: {
            fontFamily: 'Monda, sans-serif',
            fontSize: '15px'
        }
    },
    legend: {
        enabled: false
    }
});
