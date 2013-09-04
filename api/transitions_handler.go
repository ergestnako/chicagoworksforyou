package main

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
)

func TransitionsHandler(params url.Values, request *http.Request) ([]byte, *ApiError) {
	// return the transition areas

	ward := params.Get("ward")

	type Transition struct {
		Id, Ward2013, Ward2015 int
		Boundary               string
	}

	type Changes struct {
		Incoming, Outgoing []Transition
	}

	var transitions Changes
	// [ { 'id': 123, 'Ward2013': 42, 'Ward2015': 35, 'Boundary': <GeoJSON> },  ] }

	w, err := strconv.Atoi(ward)	
	if err != nil || w < 1 || w > 50 {
		return nil, &ApiError{Code: 400, Msg: "invalid ward"}
	}

	query := "SELECT ward_2013,ward_2015,id, ST_AsGeoJSON(boundary, 5, 2) FROM transition_areas %s ORDER BY ward_2013;"

	if w != 0 {
		query = fmt.Sprintf(query, fmt.Sprintf("WHERE ward_2013 = %d OR ward_2015 = %d", w, w))
	} else {
		query = fmt.Sprintf(query, "")
	}

	rows, err := api.Db.Query(query)
	if err != nil {
		log.Printf("error fetching transition areas: %s", err)
	}

	for rows.Next() {
		var t Transition
		if err := rows.Scan(&t.Ward2013, &t.Ward2015, &t.Id, &t.Boundary); err != nil {
			log.Printf("error loading transition area result: %s", err)
		}
		
		if t.Ward2013 == w {
			transitions.Outgoing = append(transitions.Outgoing, t)
		} else {
			transitions.Incoming = append(transitions.Incoming, t)
		}
	}

	return dumpJson(transitions), nil
}
