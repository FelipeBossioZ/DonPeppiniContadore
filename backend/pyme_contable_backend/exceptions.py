from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    # Llama primero al manejador de excepciones por defecto de REST framework,
    # para obtener la respuesta de error estándar.
    response = exception_handler(exc, context)

    # Ahora, personaliza la respuesta.
    if response is not None:
        custom_response = {
            'error': {
                'status_code': response.status_code,
                'message': 'Se ha producido un error.',
                'details': {}
            }
        }

        if isinstance(response.data, dict):
            # Si el error es un diccionario (errores de validación), lo formateamos.
            details = {}
            for key, value in response.data.items():
                if isinstance(value, list):
                    details[key] = ", ".join(map(str, value))
                else:
                    details[key] = str(value)
            custom_response['error']['message'] = 'Error de validación.'
            custom_response['error']['details'] = details
        else:
            # Para otros errores (autenticación, permisos, etc.)
            custom_response['error']['message'] = str(response.data.get('detail', 'Error desconocido.'))

        response.data = custom_response

    return response