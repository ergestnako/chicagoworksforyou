package main

import (
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

func RequestCountsHandler(params url.Values, request *http.Request) ([]byte, *ApiError) {
	// for a given request service type and date, return the count
	// of requests for that date, grouped by ward, and the city total
	// The output is a map where keys are ward identifiers, and the value is the count.
	//
	// Sample request and output:
	// $ curl "http://localhost:5000/requests/4fd3b167e750846744000005/counts.json?end_date=2013-06-10&count=1"
	// {
	//   "DayData": [
	//     "2013-06-04",
	//     "2013-06-05",
	//     "2013-06-06",
	//     "2013-06-07",
	//     "2013-06-08",
	//     "2013-06-09",
	//     "2013-06-10"
	//   ],
	//   "CityData": {
	//     "Average": 8.084931,
	//     "Count": 2951,
	//     "DailyMax": 1234
	//   },
	//   "WardData": {
	//     "1": {
	//       "Counts": [
	//         29,
	//         19,
	//         40,
	//         60,
	//         16,
	//         2,
	//         35
	//       ],
	//       "Average": 16.671232
	//     },
	//     "10": {
	//       "Counts": [
	//         22,
	//         2,
	//         28,
	//         6,
	//         2,
	//         5,
	//         6
	//       ],
	//       "Average": 6.60274
	//     },

	vars := mux.Vars(request)
	service_code := vars["service_code"]

	// determine date range. default is last 7 days.
	days, _ := strconv.Atoi(params["count"][0])

	chi, _ := time.LoadLocation("America/Chicago")
	end, _ := time.ParseInLocation("2006-01-02", params["end_date"][0], chi)
	end = end.AddDate(0, 0, 1) // inc to the following day
	start := end.AddDate(0, 0, -days)

	rows, err := api.Db.Query(`SELECT total,ward,requested_date 
		FROM daily_counts
		WHERE service_code = $1 
			AND requested_date >= $2 
			AND requested_date < $3
		ORDER BY ward DESC, requested_date DESC`,
		string(service_code), start, end)

	if err != nil {
		log.Fatal("error fetching data for RequestCountsHandler", err)
	}

	data := make(map[int]map[string]int)
	// { 32: { '2013-07-23': 42, '2013-07-24': 41 }, 3: { '2013-07-23': 42, '2013-07-24': 41 } }

	for rows.Next() {
		var ward, count int
		var date time.Time

		if err := rows.Scan(&count, &ward, &date); err != nil {
			// FIXME: handle
		}

		if _, present := data[ward]; !present {
			data[ward] = make(map[string]int)
		}

		data[ward][date.Format("2006-01-02")] = count
	}

	// log.Printf("data\n\n%+v", data)

	type WardCount struct {
		Ward    int
		Counts  []int
		Average float32
	}

	counts := make(map[int]WardCount)
	var day_data []string

	// generate a list of days returned in the results
	for day := 0; day < days; day++ {
		day_data = append(day_data, start.AddDate(0, 0, day).Format("2006-01-02"))
	}

	// for each ward, and each day, find the count and populate result
	for i := 1; i < 51; i++ {
		for day := 0; day < days; day++ {
			d := start.AddDate(0, 0, day)
			c := 0
			if total_for_day, present := data[i][d.Format("2006-01-02")]; present {
				c = total_for_day
			}

			tmp := counts[i]
			tmp.Counts = append(counts[i].Counts, c)
			counts[i] = tmp
		}
	}

	// log.Printf("counts\n\n%+v", counts)

	rows, err = api.Db.Query(`SELECT SUM(total)/365.0, ward
             FROM daily_counts
             WHERE requested_date >= DATE(NOW() - INTERVAL '1 year')
                     AND service_code = $1
             GROUP BY ward;`, service_code)

	if err != nil {
		log.Print("error querying for year average", err)
	}

	for rows.Next() {
		var count float32
		var ward int
		if err := rows.Scan(&count, &ward); err != nil {
			log.Print("error loading ward counts ", err, count, ward)
		}

		tmp := counts[ward]
		tmp.Average = count
		counts[ward] = tmp
	}

	type CityCount struct {
		Average  float32
		DailyMax []int
		Count    int
	}

	// find total opened for the entire city for date range
	var city_total CityCount
	err = api.Db.QueryRow(`SELECT SUM(total)
                     FROM daily_counts
                     WHERE service_code = $1
                             AND requested_date >= $2
                             AND requested_date < $3;`,
		string(service_code), start, end).Scan(&city_total.Count)

	if err != nil {
		log.Print("error loading city-wide total count for %s. err: %s", service_code, err)
	}

	city_total.Average = float32(city_total.Count) / 365.0

	// find the seven largest days of all time
	rows, err = api.Db.Query(`SELECT total
                     FROM daily_counts
                     WHERE service_code = $1
                     ORDER BY total DESC
                     LIMIT 7;`,
		string(service_code))

	for rows.Next() {
		var daily_max int
		if err := rows.Scan(&daily_max); err != nil {
			log.Print("error loading city-wide daily max for %s. err: %s", service_code, err)
		}

		city_total.DailyMax = append(city_total.DailyMax, daily_max)
	}

	// pluck data to return, ensure we return a number, even zero, for each ward
	type WC struct {
		Counts  []int
		Average float32
	}

	complete_wards := make(map[string]WC)
	for i := 1; i < 51; i++ {
		k := strconv.Itoa(i)
		tmp := complete_wards[k]
		tmp.Counts = counts[i].Counts
		tmp.Average = counts[i].Average
		complete_wards[k] = tmp
	}

	type RespData struct {
		DayData  []string
		CityData CityCount
		WardData map[string]WC
	}

	return dumpJson(RespData{CityData: city_total, WardData: complete_wards, DayData: day_data}), nil
}
