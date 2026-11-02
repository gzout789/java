package com.fenglin.springboottest.config;

import com.fenglin.springboottest.security.AdminAuthInterceptor;
import com.fenglin.springboottest.security.AuthInterceptor;
import com.fenglin.springboottest.security.LoginRateLimitInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final AdminAuthInterceptor adminAuthInterceptor;
    private final LoginRateLimitInterceptor loginRateLimitInterceptor;

    public WebConfig(AuthInterceptor authInterceptor, AdminAuthInterceptor adminAuthInterceptor,
                     LoginRateLimitInterceptor loginRateLimitInterceptor) {
        this.authInterceptor = authInterceptor;
        this.adminAuthInterceptor = adminAuthInterceptor;
        this.loginRateLimitInterceptor = loginRateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 登录限流：只拦两个登录入口（顺序在鉴权之前）
        registry.addInterceptor(loginRateLimitInterceptor)
                .addPathPatterns("/api/login", "/api/admin/login");

        // 前台：将军令牌。后台路径交给下一个拦截器，避免两类令牌互相顶用
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/login", "/api/register", "/api/admin/**");

        // 后台：管理令牌（role=admin）
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/admin/**")
                .excludePathPatterns("/api/admin/login");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
