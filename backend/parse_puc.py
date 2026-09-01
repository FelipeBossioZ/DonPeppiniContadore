import re
import csv

# Texto extraído de actualicese.com
raw_puc_text = """
1 Activo
11 Disponible
1105 Caja
110505 Caja general
110510 Cajas menores
110515 Moneda extranjera
1110 Bancos
111005 Moneda nacional
111010 Moneda extranjera
1115 Remesas en tránsito
111505 Moneda nacional
111510 Moneda extranjera
1120 Cuentas de ahorro
112005 Bancos
112010 Corporaciones de ahorro y vivienda
112015 Organismos cooperativos financieros
1125 Fondos
112505 Rotatorios moneda nacional
112510 Rotatorios moneda extranjera
112515 Especiales moneda nacional
112520 Especiales moneda extranjera
112525 De amortización moneda nacional
112530 De amortización moneda extranjera
12 Inversiones
1205 Acciones
120505 Agricultura, ganadería, caza y silvicultura
120510 Pesca
120515 Explotación de minas y canteras
120520 Industria manufacturera
120525 Suministro de electricidad, gas y agua
120530 Construcción
120535 Comercio al por mayor y al por menor
120540 Hoteles y restaurantes
120545 Transporte, almacenamiento y comunicaciones
120550 Actividad financiera
120555 Actividades inmobiliarias, empresariales y de alquiler
120560 Enseñanza
120565 Servicios sociales y de salud
120570 Otras actividades de servicios comunitarios, sociales y personales
1210 Cuotas o partes de interés social
121005 Agricultura, ganadería, caza y silvicultura
121010 Pesca
121015 Explotación de minas y canteras
121020 Industria manufacturera
121025 Suministro de electricidad, gas y agua
121030 Construcción
121035 Comercio al por mayor y al por menor
121040 Hoteles y restaurantes
121045 Transporte, almacenamiento y comunicaciones
121050 Actividad financiera
121055 Actividades inmobiliarias, empresariales y de alquiler
121060 Enseñanza
121065 Servicios sociales y de salud
121070 Otras actividades de servicios comunitarios, sociales y personales
1215 Bonos
121505 Bonos públicos moneda nacional
121510 Bonos públicos moneda extranjera
121515 Bonos ordinarios
121520 Bonos convertibles en acciones
121595 Otros
1220 Cédulas
122005 Cédulas de capitalización
122010 Cédulas hipotecarias
122015 Cédulas de inversión
122095 Otras
1225 Certificados
122505 Certificados de depósito a término (CDT)
122510 Certificados de depósito de ahorro
122515 Certificados de ahorro de valor constante (CAVC)
122520 Certificados de cambio
122525 Certificados cafeteros valorizables
122530 Certificados eléctricos valorizables (CEV)
122535 Certificados de reembolso tributario (CERT)
122540 Certificados de desarrollo turístico
122545 Certificados de inversión forestal (CIF)
122595 Otros
1230 Papeles comerciales
123005 Empresas comerciales
123010 Empresas industriales
123015 Empresas de servicios
1235 Títulos
123505 Títulos de desarrollo agropecuario
123510 Títulos canjeables por certificados de cambio
123515 Títulos de tesorería (TES)
123520 Títulos de participación
123525 Títulos de crédito de fomento
123530 Títulos financieros agroindustriales (TFA)
123535 Títulos de ahorro cafetero (TAC)
123540 Títulos de ahorro nacional (TAN)
123545 Títulos energéticos de rentabilidad creciente (TER)
123550 Títulos de ahorro educativo (TAE)
123555 Títulos financieros industriales y comerciales
123560 Tesoros
123565 Títulos de devolución de impuestos nacionales (TIDIS)
123570 Títulos inmobiliarios
123595 Otros
1240 Aceptaciones bancarias o financieras
124005 Bancos comerciales
124010 Compañías de financiamiento comercial
124015 Corporaciones financieras
124095 Otras
1245 Derechos fiduciarios
124505 Fideicomisos de inversión moneda nacional
124510 Fideicomisos de inversión moneda extranjera
1250 Derechos de recompra de inversiones negociadas (repos)
125005 Acciones
125010 Cuotas o partes de interés social
125015 Bonos
125020 Cédulas
125025 Certificados
125030 Papeles comerciales
125035 Títulos
125040 Aceptaciones bancarias o financieras
125095 Otros
1255 Obligatorias
125505 Bonos de financiamiento especial
125510 Bonos de financiamiento presupuestal
125515 Bonos para desarrollo social y seguridad interna (BDSI)
125595 Otras
1295 otras inversiones
129505 aportes en cooperativas
129510 derechos en clubes sociales
129515 acciones o derechos en clubes deportivos
129520 bonos en colegios
129595 diversas
1299 provisiones
129905 Acciones
129910 cuotas o partes de interes social
129915 bonos
129920 cedulas
129925 certificados
129930 papeles comerciales
129935 titulos
129940 aceptaciones bancarias o financieras
129945 derechos fiduciarios
129950 derechos de recompra de inversiones negociadas
129955 obligatorias
129960 cuentas en participacion
129995 otras inversiones
13 deudores
1305 clientes
130505 nacionales
130510 del exterior
130515 deudores del sistema
1310 cuentas corrientes comerciales
131005 casa matriz
131010 compañias vinculadas
131015 accionistas o socios
131020 particulares
131095 otras
1315 cuentas por cobrar a casa matriz
131505 ventas
131510 pagos a nombre de casa matriz
131515 valores recibidos por casa matriz
131520 prestamos
1320 cuentas por cobrar a vinculados economicos
132005 filiales
132010 subsidiarias
132015 sucursales
1325 cuenta s por cobrar a socios y accionistas
132505 a socios
132510 a accionistas
1330 anticipos y avances
133005 a proveedores
133010 a contratistas
133015 a trabajadores
133020 a agentes
133025 a concesionarios
133030 de adjudicaciones
133095 otros
1335 depositos
133505 para importaciones
133510 para servicios
133515 para contratos
133520 para responsabilidades
133525 Para juicios ejecutivos
133530 para adquisicion de acciones, cuotas o derechos sociales
133535 en garantia
133595 otros
1340 promesas de compra venta
134005 de bienes raices
134010 de maquinaria y equipo
134015 de flota y equipo de transporte
134020 de flota y equipo aereo
134025 de flota y equipo ferreo
134030 de flota y equipo fluvial y/o maritimo
134035 de semovientes
134095 de otros bienes
1345 ingresos por cobrar
134505 dividendos y/o participaciones
134510 intereses
134515 comisiones
134520 honorarios
134525 servicios
134530 arrendamientos
134535 cert por cobrar
134595 otros
1350 retencion sobre contratos
135005 de construccion
135010 de prestacion de servicios
135095 otros
1355 anticipo de impuestos y contribuciones o saldos a favor
135505 anticipo de impuestos de renta y complementarios
135510 anticipo de impuestos de industria y comercio
135515 retencion en la fuente
135517 Impuesto a las ventas y retenido
135518 Impuesto de Industria y comercio y retenido
135520 sobrantes en liquidacion privada de impuestos
135525 contribuciones
135530 impuestos descontables
135595 otros
1360 reclamaciones
136005 a compañias aseguradoras
136010 a transportadores
136015 por tiquetes aereos
136095 otras
1365 cuentas por cobrar a trabajadores
136505 vivienda
136510 vehiculos
136515 educacion
136520 medicos, odontologicos y similares
136525 calamidad domestica
136530 responsabilidades
136595 otros
1380 deudores varios
138005 depositarios
138010 Comisionistas de bolsas
138015 fondo de inversion
138020 cuentas por cobrar de terceros
138025 pagos por cuenta de terceros
138030 fondos de inversion social
138095 otros
1390 deudas de dificil cobro
1399 provisiones
139905 clientes
139910 cuentas corrientes comerciales
139915 cuentas por cobrar a casa matriz
139920 cuentas por cobrar a vinculados economicos
139925 cuentas por cobrar a socios y accionistas
139930 anticipos y avances
139935 depositos
139940 promesas de compraventa
139945 ingresos por cobrar
139950 retencion sobre contratos
139955 reclamaciones
139960 cuentas por cobrar a trabajadores
139965 prestamos a particulares
139975 deudores varios
2 Pasivo
21 Obligaciones financieras
2105 Bancos nacionales
210505 Sobregiros
210510 Pagarés
210515 Cartas de crédito
210520 Aceptaciones bancarias
2110 Bancos del exterior
211005 Sobregiros
211010 Pagarés
211015 Cartas de crédito
211020 Aceptaciones bancarias
2115 Corporaciones financieras
211505 Pagarés
211510 Aceptaciones financieras
211515 Cartas de crédito
211520 Contratos de arrendamiento financiero (leasing)
2120 Compañías de financiamiento comercial
212005 Pagarés
212010 Aceptaciones financieras
212020 Contratos de arrendamiento financiero (leasing)
2125 Corporaciones de ahorro y vivienda
212505 Sobregiros
212510 Pagarés
212515 Hipotecarias
2145 Obligaciones gubernamentales
214505 Gobierno Nacional
214510 Entidades oficiales
2195 Otras obligaciones
219505 Particulares
219510 Compañías vinculadas
219515 Casa matriz
219520 Socios o accionistas
219525 Fondos y cooperativas
219530 Directores
219595 Otras
22 Proveedores
2205 Nacionales
2210 Del exterior
2215 Cuentas corrientes comerciales
2220 Casa matriz
2225 Compañías vinculadas
23 Cuentas por pagar
2305 Cuentas corrientes comerciales
2310 A casa matriz
2315 A compañías vinculadas
2320 A contratistas
2330 Órdenes de compra por utilizar
2335 Costos y gastos por pagar
233505 Gastos financieros
233510 Gastos legales
233515 Libros, suscripciones, periódicos y revistas
233520 Comisiones
233525 Honorarios
233530 Servicios técnicos
233535 Servicios de mantenimiento
233540 Arrendamientos
233545 Transportes, fletes y acarreos
233550 Servicios públicos
233555 Seguros
233560 Gastos de viaje
233565 Gastos de representación y relaciones públicas
233570 Servicios aduaneros
233595 Otros
2350 Regalías por pagar
2355 Deudas con accionistas o socios
235505 Accionistas
235510 Socios
2360 Dividendos o participaciones por pagar
236005 Dividendos
236010 Participaciones
2365 Retención en la fuente
236505 Salarios y pagos laborales
236510 Dividendos y/o participaciones
236515 Honorarios
236520 Comisiones
236525 Servicios
236530 Arrendamientos
236535 Rendimientos financieros
236540 Compras
236545 Loterías, rifas, apuestas y similares
236550 Por pagos al exterior
236555 Por ingresos obtenidos en el exterior
236560 Enajenación propiedades planta y equipo, personas naturales
236565 Por impuesto de timbre
236570 Otras retenciones y patrimonio
236575 Autorretenciones
2367 Impuesto a las ventas retenido
2368 Impuesto de industria y comercio retenido
2370 Retenciones y aportes de nómina
237005 Aportes a entidades promotoras de salud, EPS
237006 Aportes a administradoras de riesgos profesionales, ARP
237010 Aportes al ICBF, SENA y cajas de compensación
237015 Aportes al FIC
237025 Embargos judiciales
237030 Libranzas
237035 Sindicatos
237040 Cooperativas
237045 Fondos
237095 Otros
2380 Acreedores varios
238005 Depositarios
238010 Comisionistas de bolsas
238015 Sociedad administradora-Fondos de inversión
238020 Reintegros por pagar
238025 Fondo de perseverancia
238030 Fondos de cesantías y/o pensiones
238035 Donaciones asignadas por pagar
238095 Otros
24 Impuestos, gravámenes y tasas
2404 De renta y complementarios
240405 Vigencia fiscal corriente
240410 Vigencias fiscales anteriores
2408 Impuesto sobre las ventas por pagar
2412 De industria y comercio
241205 Vigencia fiscal corriente
241210 Vigencias fiscales anteriores
2416 A la propiedad raíz
2420 Derechos sobre instrumentos públicos
2424 De valorización
242405 Vigencia fiscal corriente
242410 Vigencias fiscales anteriores
2428 De turismo
2432 Tasa por utilización de puertos
2436 De vehículos
243605 Vigencia fiscal corriente
243610 Vigencias fiscales anteriores
2440 De espectáculos públicos
2444 De hidrocarburos y minas
244405 De hidrocarburos
244410 De minas
2452 A las exportaciones cafeteras
2456 A las importaciones
2460 Cuotas de fomento
2464 De licores, cervezas y cigarrillos
246405 De licores
246410 De cervezas
246415 De cigarrillos
2468 Al sacrificio de ganado
2472 Al azar y juegos
2495 Otros
3 Patrimonio
31 Capital social
3105 Capital suscrito y pagado
310505 Capital autorizado
310510 Capital por suscribir (DB)
310515 Capital suscrito por cobrar (DB)
3115 Aportes sociales
311505 Cuotas o partes de interés social
311510 Aportes de socios-fondo mutuo de inversión
311515 Contribución de la empresa-fondo mutuo de inversión
311520 Suscripciones del público
32 Superávit de capital
3205 Prima en colocación de acciones, cuotas o partes de interés social
320505 Prima en colocación de acciones
320510 Prima en colocación de acciones por cobrar (DB)
320515 Prima en colocación de cuotas o partes de interés social
3210 Donaciones
321005 En dinero
321010 En valores mobiliarios
321015 En bienes muebles
321020 En bienes inmuebles
321025 En intangibles
3225 Superávit método de participación
322505 De acciones
322510 De cuotas o partes de interés social
33 Reservas
3305 Reservas obligatorias
330505 Reserva legal
330510 Reservas por disposiciones fiscales
330515 Reserva para readquisición de acciones
330516 Acciones propias readquiridas (DB)
330517 Reserva para readquisición de cuotas o partes de interés social
330518 Cuotas o partes de interés social propias readquiridas (DB)
330520 Reserva para extensión agropecuaria
330525 Reserva Ley 7ª de 1990
330530 Reserva para reposición de semovientes
330535 Reserva Ley 4ª de 1980
330595 Otras
3310 Reservas estatutarias
331005 Para futuras capitalizaciones
331010 Para reposición de activos
331015 Para futuros ensanches
331095 Otras
3315 Reservas ocasionales
331505 Para beneficencia y civismo
331510 Para futuras capitalizaciones
331515 Para futuros ensanches
331520 Para adquisición o reposición de propiedades, planta y equipo
331525 Para investigaciones y desarrollo
331530 Para fomento económico
331535 Para capital de trabajo
331540 Para estabilización de rendimientos
331545 A disposición del máximo órgano social
331595 Otras
36 Resultados del ejercicio
3605 Utilidad del ejercicio
3610 Pérdida del ejercicio
37 Resultados de ejercicios anteriores
3705 Utilidades acumuladas
3710 Pérdidas acumuladas
38 Superávit por valorizaciones
3805 De inversiones
380505 Acciones
380510 Cuotas o partes de interés social
380515 Derechos fiduciarios
4 Ingresos
41 Operacionales
4105 Agricultura, ganadería, caza y silvicultura
4110 Pesca
4115 Explotación de minas y canteras
4120 Industrias manufactureras
4125 Suministro de electricidad, gas y agua
4130 Construcción
4135 Comercio al por mayor y al por menor
4140 Hoteles y restaurantes
4145 Transporte, almacenamiento y comunicaciones
4150 Actividad financiera
4155 Actividades inmobiliarias, empresariales y de alquiler
4160 Enseñanza
4165 Servicios sociales y de salud
4170 Otras actividades de servicios comunitarios, sociales y personales
4175 Devoluciones en ventas (DB)
42 No operacionales
4210 financieros
4215 dividendos y participaciones
4220 arrendamientos
4225 comisiones
4230 honorarios
4235 servicios
4240 utilidad en venta de inversiones
4245 utilidad en venta de propiedades planta y equipo
4248 utilidad en venta de otros bienes
4250 recuperaciones
4255 indemnizaciones
4265 ingresos de ejercicios anteriores
4295 diversos
5 Gastos
51 Operacionales de administración
5105 Gastos de personal
5110 Honorarios
5115 Impuestos
5120 Arrendamientos
5125 Contribuciones y afiliaciones
5130 Seguros
5135 Servicios
5140 Gastos legales
5145 Mantenimiento y reparaciones
5150 Adecuación e instalación
5155 Gastos de viaje
5160 Depreciaciones
5165 Amortizaciones
5195 Diversos
5199 Provisiones
52 Operacionales de ventas
5205 Gastos de personal
5210 Honorarios
5215 Impuestos
5220 Arrendamientos
5225 Contribuciones y afiliaciones
5230 Seguros
5235 Servicios
5240 Gastos legales
5245 Mantenimiento y reparaciones
5250 Adecuación e instalación
5255 Gastos de viaje
5260 Depreciaciones
5265 Amortizaciones
5295 Diversos
5299 Provisiones
53 No operacionales
5305 Financieros
5310 Pérdida en venta y retiro de bienes
5315 Gastos extraordinarios
5395 Gastos diversos
54 Impuesto de renta y complementarios
5405 Impuesto de renta y complementarios
59 Ganancias y pérdidas
5905 Ganancias y pérdidas
6 Costos de ventas
61 Costo de ventas y de prestación de servicios
6105 Agricultura, ganadería, caza y silvicultura
6110 Pesca
6115 Explotación de minas y canteras
6120 Industrias manufactureras
6125 Suministro de electricidad, gas y agua
6130 Construcción
6135 Comercio al por mayor y al por menor
6140 Hoteles y restaurantes
6145 Transporte, almacenamiento y comunicaciones
6150 Actividad financiera
6155 Actividades inmobiliarias, empresariales y de alquiler
6160 Enseñanza
6165 Servicios sociales y de salud
6170 Otras actividades de servicios comunitarios, sociales y personales
62 Compras
6205 De mercancías
6210 De materias primas
6215 De materiales indirectos
6220 Compra de energía
6225 Devoluciones en compras (CR)
7 Costos de producción o de operación
8 Cuentas de orden deudoras
9 Cuentas de orden acreedoras
"""

def parse_puc():
    # Expresión regular para capturar el código y el nombre
    # El código puede tener 1, 2, 4, o 6 dígitos
    line_regex = re.compile(r"^\s*(\d{1,8})\s+(.+?)\s*$")

    accounts = []
    lines = raw_puc_text.strip().split('\n')

    for line in lines:
        match = line_regex.match(line)
        if match:
            codigo, nombre = match.groups()

            # Solo nos interesan las cuentas con código de 1, 2, 4, 6 y 8 dígitos.
            # El PUC oficial usa hasta 6, pero algunos se extienden a 8.
            if len(codigo) in [1, 2, 4, 6, 8]:
                 # Ignorar cuentas que no son útiles o son de control
                if '(DB)' in nombre or '(CR)' in nombre or 'ajustes por inflacion' in nombre.lower():
                    continue
                accounts.append({'codigo': codigo, 'nombre': nombre.strip()})

    # Escribir a un archivo CSV
    output_filename = 'backend/puc_colombia.csv'
    with open(output_filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['codigo', 'nombre']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()
        writer.writerows(accounts)

    print(f"Archivo '{output_filename}' creado con {len(accounts)} cuentas.")

if __name__ == "__main__":
    parse_puc()