var weatherApp = angular.module('weatherApp', []);

weatherApp.filter('capitalize', function() {
    return function(input) {
        if (input) {
            return input.charAt(0).toUpperCase() + input.slice(1);
        }
        return '';
    };
});

weatherApp.controller('WeatherController', ['$scope', '$http', function($scope, $http) {
    $scope.cityName = '';
    $scope.weatherData = null;
    $scope.currentTemp = null;
    $scope.currentWeather = '';
    $scope.highTemp = null;
    $scope.lowTemp = null;
    $scope.currentPrecip = null;
    $scope.currentDay = '';

    var hourlyChart = null;
    var dailyChart = null;

    $scope.getWeather = function() {
        const apiKey = '30d4741c779ba94c470ca1f63045390a';
        $http.get(`http://api.openweathermap.org/geo/1.0/direct?q=${$scope.cityName}&limit=1&appid=${apiKey}`)
            .then(function(geoResponse) {
                const geoData = geoResponse.data[0];
                const lat = geoData.lat;
                const lon = geoData.lon;
                return $http.get(`http://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&appid=${apiKey}`);
            })
            .then(function(weatherResponse) {
                $scope.weatherData = weatherResponse.data;
                $scope.currentTemp = $scope.weatherData.current.temp - 273.15;
                $scope.currentWeather = $scope.weatherData.current.weather[0].description;
                $scope.highTemp = Math.max(...$scope.weatherData.daily.map(day => day.temp.max - 273.15));
                $scope.lowTemp = Math.min(...$scope.weatherData.daily.map(day => day.temp.min - 273.15));
                $scope.currentPrecip = $scope.weatherData.hourly[0].pop * 100;
                $scope.currentDay = new Date($scope.weatherData.current.dt * 1000).toLocaleDateString([], { weekday: 'long' });
                
                if (hourlyChart) {
                    hourlyChart.destroy();
                }
                if (dailyChart) {
                    dailyChart.destroy();
                }
                
                hourlyChart = plotWeatherData($scope.cityName, $scope.weatherData);
                dailyChart = plotDailyWeatherData($scope.cityName, $scope.weatherData);
            })
            .catch(function(error) {
                console.error('Error fetching weather data:', error);
            });
    };
}]);

function plotWeatherData(cityName, weatherData) {
    const ctx = document.getElementById('weatherChart').getContext('2d');

    const hours = weatherData.hourly.slice(0, 8).map(hour => new Date(hour.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    const temps = weatherData.hourly.slice(0, 8).map(hour => hour.temp - 273.15);
    const precips = weatherData.hourly.slice(0, 8).map(hour => hour.pop * 100);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Temperature (°C)',
                data: temps,
                borderColor: 'rgba(0, 0, 255, 1)',
                borderWidth: 2,
                fill: false,
                yAxisID: 'y-axis-1'
            }, {
                label: 'Precipitation (%)',
                data: precips,
                backgroundColor: 'rgba(0, 0, 255, 0.2)',
                borderColor: 'rgba(0, 0, 255, 0.2)',
                borderWidth: 1,
                yAxisID: 'y-axis-2'
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    id: 'y-axis-1',
                    type: 'linear',
                    position: 'left',
                    ticks: {
                        beginAtZero: true
                    }
                }, {
                    id: 'y-axis-2',
                    type: 'linear',
                    position: 'right',
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            title: {
                display: true,
                text: `Hourly Weather Forecast for ${cityName}`
            }
        }
    });
}

function plotDailyWeatherData(cityName, weatherData) {
    const ctx = document.getElementById('dailyWeatherChart').getContext('2d');

    const days = weatherData.daily.map(day => new Date(day.dt * 1000).toLocaleDateString([], { weekday: 'long' }));
    const dailyTemps = weatherData.daily.map(day => day.temp.day - 273.15);
    const dailyPrecips = weatherData.daily.map(day => day.pop * 100);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Temperature (°C)',
                data: dailyTemps,
                borderColor: 'rgba(255, 0, 0, 1)',
                borderWidth: 2,
                fill: false,
                yAxisID: 'y-axis-1'
            }, {
                label: 'Precipitation (%)',
                data: dailyPrecips,
                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                borderColor: 'rgba(255, 0, 0, 0.2)',
                borderWidth: 1,
                yAxisID: 'y-axis-2'
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    id: 'y-axis-1',
                    type: 'linear',
                    position: 'left',
                    ticks: {
                        beginAtZero: true
                    }
                }, {
                    id: 'y-axis-2',
                    type: 'linear',
                    position: 'right',
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            title: {
                display: true,
                text: `Daily Weather Forecast for ${cityName}`
            }
        }
    });
}
