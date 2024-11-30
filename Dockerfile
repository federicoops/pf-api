FROM python:3.9

WORKDIR /pfapi
COPY ./requirements.txt /pfapi/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /pfapi/requirements.txt
COPY ./ /pfapi/

CMD ["fastapi", "run", "main.py"]
