window.GRAPH = {
  "nodes": [
    {"id":"10.0.0.5","label":"10.0.0.5","role":"value"},
    {"id":"15","label":"15","role":"value"},
    {"id":"192.168.1.3","label":"192.168.1.3","role":"value"},
    {"id":"3","label":"3","role":"value"},
    {"id":"fifskje","label":"fifskje","role":"value"},
    {"id":"isValidIP()","label":"isValidIP()","role":"function"},
    {"id":"isValidIP(10.0.0.5)","label":"isValidIP(10.0.0.5)","role":"application"},
    {"id":"isValidIP(192.168.1.3)","label":"isValidIP(192.168.1.3)","role":"application"},
    {"id":"lastOctet()","label":"lastOctet()","role":"function"},
    {"id":"lastOctet(192.168.1.3)","label":"lastOctet(192.168.1.3)","role":"application"},
    {"id":"octetSum()","label":"octetSum()","role":"function"},
    {"id":"octetSum(10.0.0.5)","label":"octetSum(10.0.0.5)","role":"application"},
    {"id":"∅","label":"∅","role":"value"}
  ],
  "edges": [
    {"from":"10.0.0.5","to":"isValidIP(10.0.0.5)"},
    {"from":"10.0.0.5","to":"octetSum(10.0.0.5)"},
    {"from":"192.168.1.3","to":"isValidIP(192.168.1.3)"},
    {"from":"192.168.1.3","to":"lastOctet(192.168.1.3)"},
    {"from":"isValidIP()","to":"isValidIP(10.0.0.5)"},
    {"from":"isValidIP()","to":"isValidIP(192.168.1.3)"},
    {"from":"isValidIP(10.0.0.5)","to":"10.0.0.5"},
    {"from":"isValidIP(192.168.1.3)","to":"192.168.1.3"},
    {"from":"lastOctet()","to":"lastOctet(192.168.1.3)"},
    {"from":"lastOctet(192.168.1.3)","to":"3"},
    {"from":"octetSum()","to":"octetSum(10.0.0.5)"},
    {"from":"octetSum(10.0.0.5)","to":"15"}
  ],
  "pivot": {
    "subjects": [
      "10.0.0.5",
      "192.168.1.3"
    ],
    "columns": [
      "isValidIP",
      "lastOctet",
      "octetSum"
    ],
    "cells": [
      {"s":"10.0.0.5","c":"isValidIP","res":"10.0.0.5","app":"isValidIP(10.0.0.5)"},
      {"s":"10.0.0.5","c":"octetSum","res":"15","app":"octetSum(10.0.0.5)"},
      {"s":"192.168.1.3","c":"isValidIP","res":"192.168.1.3","app":"isValidIP(192.168.1.3)"},
      {"s":"192.168.1.3","c":"lastOctet","res":"3","app":"lastOctet(192.168.1.3)"}
    ]
  },
  "tables": [
    {"cols":["isValidIP","octetSum"],"rows":["10.0.0.5"]},
    {"cols":["isValidIP","lastOctet"],"rows":["192.168.1.3"]}
  ],
  "chains": [],
  "listings": []
};
