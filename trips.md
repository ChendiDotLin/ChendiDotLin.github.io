---
layout: page
title: My Trips
subtitle: Either My Body or My Soul is on the Bed
---
<!DOCTYPE html>
<html>
<head>
<style>
* {
  box-sizing: border-box;
}

.column {
  float: left;
  width: 33.33%;
  padding: 5px;
}

/* Clearfix (clear floats) */
.row::after {
  content: "";
  clear: both;
  display: table;
}
</style>
</head>
<body>

<h2>Images Side by Side</h2>
<p>How to create side-by-side images with the CSS float property:</p>

<div class="row">
  <div class="column">
    <img src="/Trips/paris.jpeg" alt="Snow" style="width:100%">
  </div>
  <div class="column">
    <img src="/Trips/paris.jpeg" alt="Forest" style="width:100%">
  </div>
  <div class="column">
    <img src="/Trips/paris.jpeg" alt="Mountains" style="width:100%">
  </div>
</div>

</body>
</html>


![](/Trips/paris.jpeg)
*Paris, France (2018)*

<p>
    <img src="/Trips/paris.jpeg" alt='missing'  width="45%">
    <!-- <em>Paris, France (2018)</em> -->
      <img src="/Trips/paris.jpeg" alt='missing'  width="45%">
    <em>Paris, France (2018)</em>
</p>

<p>
  
</p>