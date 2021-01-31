//
// getQuality.js
// - Retrieve the Wireless Quality value for DD-WRT
//
//  NOTE: The "wl_quality" data field is not always available on all DD-WRT nodes!
//  A lot depends on which set of hardware you are using, and what mode it is in.
//  This program works on a TP-Link AC1750/C7 box, running DD-WRT v3.0-r39296 std (03/27/19)
//  in AP mode.
//
//  John D. Allen
//  October 2020
//

var DDWRT = require('./ddwrt.js');
var config = require('./config/config.json');
var mqtt = require('mqtt');

var DEBUG = config.debug;
var PERIOD = config.period || 120000;  // Default is 2 minutes

// MQTT connection options
var copts = {
    clientId: "wlQual",
    keepalive: 5000
};

var opts7 = {
    DEBUG: 0,
    IPAddr: config.ipaddr,
    User: config.username,
    Passwd: config.passwd
  };

  var rrout = [];

  var ap1 = new DDWRT(opts7);

//---------------------------------------------------------------------------
// MQTT Stuff
//---------------------------------------------------------------------------
var client = mqtt.connect(config.mqttBroker, copts);

client.on("connect", function() {
    if (DEBUG > 3) { console.log("Connected to MQTT Broker..."); }
});

function getWLQuality() {
    ap1.init().then((x) => {
        ap1.getAP("wl_quality").then((out) =>  {
            setTimeout(getWLQuality, PERIOD);             // Call every PERIOD
            
            wlq = `{"quality": ${out.slice(0, -1)}}`;
            if (DEBUG > 8) { console.log(wlq); }
            client.publish("info/wlqual", wlq);
        }).catch((err) => {
            if (DEBUG > 3) { console.log("Error on getAP() " + err); }
            //process.exit(1);
            setTimeout(getWLQuality, parseInt(PERIOD / 2));
        });
    }).catch((err) => {
        if (DEBUG > 3) { console.log("Error in Init! " + err); }
        //process.exit(1);
        setTimeout(getWLQuality, parseInt(PERIOD / 2));
    });
}


 getWLQuality();

   // console.log(out);

