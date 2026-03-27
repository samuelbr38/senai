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

float setpoint = 50.0;
float histerese = 5.0;

bool estadoBomba = false;

unsigned long ultimoTempo = 0;

// =========================
// LEITURA DO ULTRASSOM
// =========================
float lerNivel() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duracao = pulseIn(ECHO, HIGH, 30000);

  if (duracao == 0) {
    Serial.println("Erro sensor ultrassom");
    return nivel; // mantém valor anterior
  }

  float distancia = duracao * 0.034 / 2.0;

  float alturaTanque = 10.0;

  if (distancia > alturaTanque) distancia = alturaTanque;

  float nivelCalculado = alturaTanque - distancia;

  if (nivelCalculado < 0) nivelCalculado = 0;
  if (nivelCalculado > alturaTanque) nivelCalculado = alturaTanque;

  return (nivelCalculado / alturaTanque) * 100.0;
}

// =========================
// SETUP
// =========================
void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);

  // IMPORTANTE: evita ruído
  pinMode(SENSOR_NIVEL_SEGURANCA, INPUT_PULLUP);

  lcd.init();
  lcd.backlight();

  Serial.begin(9600);
}

// =========================
// LOOP
// =========================
void loop() {

  // Atualiza a cada 300ms (sem travar)
  if (millis() - ultimoTempo < 300) return;
  ultimoTempo = millis();

  nivel = lerNivel();

  // INVERTIDO por causa do PULLUP
  bool tanqueSeguro = !digitalRead(SENSOR_NIVEL_SEGURANCA);

  // =========================
  // SEGURANÇA
  // =========================
  if (!tanqueSeguro) {
    estadoBomba = false;
    pwmBomba = 0;

    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);

    lcd.setCursor(0, 0);
    lcd.print("FALTA AGUA!   ");
    lcd.setCursor(0, 1);
    lcd.print("BOMBA OFF     ");

    Serial.println("ALERTA: SEM AGUA NO TANQUE");

    return;
  }

  // =========================
  // CONTROLE COM HISTERESE
  // =========================
  if (nivel < (setpoint - histerese)) estadoBomba = true;
  if (nivel > (setpoint + histerese)) estadoBomba = false;

  // =========================
  // CONTROLE DA BOMBA
  // =========================
  if (estadoBomba) {

    // substitui map (agora correto com float)
    pwmBomba = 255 - ((nivel / setpoint) * (255 - 100));
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

  // =========================
  // LCD (SEM PISCAR)
  // =========================
  lcd.setCursor(0, 0);
  lcd.print("Nivel:");
  lcd.print(nivel, 1);
  lcd.print("%   ");

  lcd.setCursor(0, 1);
  if (estadoBomba) {
    lcd.print("ON ");
    lcd.print(pwmBomba);
    lcd.print("     ");
  } else {
    lcd.print("OFF        ");
  }

  // =========================
  // SERIAL DEBUG
  // =======================
  Serial.print("Nivel: ");
  Serial.print(nivel);
  Serial.print("% | Bomba: ");
  Serial.print(estadoBomba ? "ON" : "OFF");
  Serial.print(" | PWM: ");
  Serial.print(pwmBomba);
  Serial.print(" | Seguranca: ");
  Serial.println(tanqueSeguro ? "OK" : "SEM AGUA");
}