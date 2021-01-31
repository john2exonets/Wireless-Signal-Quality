# Wireless-Signal-Quality
Retrieve Wireless Signal Quality from a DD-WRT node and Publish to MQTT

This code may or may not work with your particluar hardware/DD-WRT version! I have a number of AP's running DD-WRT, and just about every version of DD-WRT provides a different output from the HTTP calls!!<br>

I have tested this code on the following:<br>

* TP-Link AC1750/C7, DD-WRT v24-sp2 (08/12/10) std-usb-ftp
* TP-Link AC1750/C7, DD-WRT v3.0-r35831 std (04/26/18)
* TP-Link AC1750/A7, DD-WRT v3.0-r39296 std (03/27/19) * Most Tested version *

The "wl_quality" field is NOT present when you put the DD-WRT AP into "WDS" mode...at least not on my nodes!<br>

