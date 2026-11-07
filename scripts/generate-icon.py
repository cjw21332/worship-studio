"""Generate Windows and app artwork based on Lucide Presentation (ISC license)."""
from PIL import Image, ImageDraw
from math import cos, sin, pi

size = 1024
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((24, 24, 1000, 1000), radius=228, fill='#106b6d')
# Lucide's Presentation paths, mapped from its 24-by-24 viewBox.
scale, left, top, stroke = 28, 176, 176, 56
def point(x, y):
    return (left + x * scale, top + y * scale)
def line(points):
    pixels = [point(x, y) for x, y in points]
    draw.line(pixels, fill='#ffffff', width=stroke)
    for x, y in pixels:
        draw.ellipse((x-stroke/2, y-stroke/2, x+stroke/2, y+stroke/2), fill='#ffffff')
line([(2,3),(22,3)])
left_curve=[(5+2*cos(pi-t*pi/2),14+2*sin(pi-t*pi/2)) for t in (i/24 for i in range(25))]
right_curve=[(19+2*cos(t*pi/2),14+2*sin(t*pi/2)) for t in (i/24 for i in range(25))]
line([(3,3),(3,14),*left_curve,(19,16),*reversed(right_curve),(21,3)])
line([(7,21),(12,16),(17,21)])
image.save('public/app-icon.png', optimize=True)
image.save('packaging/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
