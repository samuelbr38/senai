 #include <LiquidCrystal_I2C.h>

#define TRIG 7
#define ECHO 6

#define IN1 8
#define IN2 9
#define ENA 10

#define SENSOR_NIVEL_SEGURANCA 5

LiquidCrystal_I2C lcd(0x27, 16, 2);

float nivel = 0;
int pwmBomba = 0;

float setpoint = 70.0;
float histerese = 5.0;

bool estadoBomba = false;

float lerNivel() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duracao = pulseIn(ECHO, HIGH, 30000);

  if (duracao == 0) return nivel;

  float distancia = duracao * 0.034 / 2.0;

  if (distancia > 20.0) distancia = 20.0;

  float alturaTanque = 19.0;
  float nivelCalculado = alturaTanque - distancia;

  if (nivelCalculado < 0) nivelCalculado = 0;
  if (nivelCalculado > alturaTanque) nivelCalculado = alturaTanque;

  return (nivelCalculado / alturaTanque) * 100.0;
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);

  pinMode(SENSOR_NIVEL_SEGURANCA, INPUT);

  lcd.init();
  lcd.backlight();

  Serial.begin(9600);
}

void loop() {
  nivel = lerNivel();

  bool tanqueSeguro = digitalRead(SENSOR_NIVEL_SEGURANCA);

  if (!tanqueSeguro) {
    estadoBomba = false;
    pwmBomba = 0;

    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("FALTA AGUA!");
    lcd.setCursor(0, 1);
    lcd.print("BOMBA OFF");

    Serial.println("ALERTA: FALTA AGUA NO TANQUE 1");
    delay(500);
    return;
  }

  if (nivel < (setpoint - histerese)) estadoBomba = true;
  if (nivel > (setpoint + histerese)) estadoBomba = false;

  if (estadoBomba) {
    pwmBomba = map(nivel, 0, setpoint, 255, 100);
    pwmBomba = constrain(pwmBomba, 100, 255);

    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    analogWrite(ENA, pwmBomba);
  } else {
    pwmBomba = 0;
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Nivel:");
  lcd.print(nivel);
  lcd.print("%");

  lcd.setCursor(0, 1);
  if (estadoBomba) {
    lcd.print("Bomba ON ");
    lcd.print(pwmBomba);
  } else {
    lcd.print("Bomba OFF");
  }

  Serial.print("Nivel: ");
  Serial.print(nivel);
  Serial.print(" % | ");

  Serial.print("Bomba: ");
  Serial.print(estadoBomba ? "ON" : "OFF");

  Serial.print(" | PWM: ");
  Serial.print(pwmBomba);

  Serial.print(" | Seguranca: ");
  Serial.println(tanqueSeguro ? "OK" : "SEM AGUA");

  delay(500);
}