package org.tco.safepay;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("org.tco.safepay.mapper")
public class SafepayApplication {

	public static void main(String[] args) {
		SpringApplication.run(SafepayApplication.class, args);
	}

}
