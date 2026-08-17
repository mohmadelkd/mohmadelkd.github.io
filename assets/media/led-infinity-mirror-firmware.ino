// led-infinity-mirror-firmware.ino (demo)
#include <FastLED.h>

#define LED_PIN 6
#define NUM_LEDS 24
#define BRIGHTNESS 40

CRGB leds[NUM_LEDS];

void setup() {
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
}

void loop() {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CHSV(millis() / 8 + i * 16, 255, 255);
  }
  FastLED.show();
  delay(10);
}
