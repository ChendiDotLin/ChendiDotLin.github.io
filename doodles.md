---
layout: page
title: My so random doodles
subtitle: Don't even ask why

galleries:
 # gallery number one
 1:
   # row one in gallery one
   -
     - { url: 'Doodles/IMG_8272.jpg', alt: 'alt 1'}
   # row two in gallery one
   -
     - { url: 'Doodles/IMG_7684.jpg', alt: 'alt 2'}
     - { url: 'Doodles/IMG_7686.jpg', alt: 'alt 3'}

 # gallery number two
 2:
  # row one in gallery two
   -
     - { url: 'Doodles/IMG_7692.jpg', alt: 'alt 4'}
     - { url: 'Doodles/IMG_7694.jpg', alt: 'alt 5'}
---

Markdown
{% include gallery.html  gallery=1 %}
Other markdown
{% include gallery.html  gallery=2 %}

